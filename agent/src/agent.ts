/**
 * TrusteeAgent — Main Orchestrator
 *
 * The AI Trustee Agent for Trustea. Ties together rule translation, condition
 * monitoring, distribution proposals, and yield management into a single
 * monitoring cycle. Logs all decisions to MemWal for persistent audit trail.
 */

import type { CoreClient } from "@mysten/sui/client";
import {
  translateRules,
  type TrustRule,
  type TranslationResult,
} from "./rule-translator.js";
import {
  checkConditions,
  type ConditionCheck,
} from "./condition-monitor.js";
import {
  generateProposals,
  buildDistributionTx,
  isVetoWindowExpired,
  type DistributionProposal,
} from "./distribution-engine.js";
import {
  getYieldStrategy,
  logYieldAction,
  type YieldStrategy,
  type RiskProfile,
} from "./yield-manager.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration passed to TrusteeAgent constructor. */
export interface TrusteeAgentConfig {
  /** Object ID of the on-chain Trust being managed. */
  trustId: string;
  /** Deployed Trustea package ID on Sui. */
  packageId: string;
  /** Authenticated CoreClient for on-chain reads. */
  suiClient: CoreClient;
  /**
   * Connected MemWal client for persistent memory storage.
   * Typed as unknown until @mysten-incubation/memwal publishes stable types.
   */
  memwalClient: unknown;
  /** Anthropic API key for Claude-powered rule translation. */
  anthropicApiKey: string;
  /** Risk profile governing DeFi yield allocation. Defaults to "conservative". */
  riskProfile?: RiskProfile;
  /**
   * Current trust balance in dollars.
   * In Phase 2 this will be read live from the Sui object.
   */
  trustBalance?: number;
}

/** Context recalled from MemWal before making decisions. */
export interface RecalledContext {
  /** Past condition checks relevant to current rules. */
  pastConditions: Array<{ text: string; distance: number }>;
  /** Past distribution proposals and outcomes. */
  pastProposals: Array<{ text: string; distance: number }>;
  /** Past yield strategy decisions. */
  pastYield: Array<{ text: string; distance: number }>;
  /** Number of total memories queried. */
  totalRecalled: number;
  /** Time taken to recall (ms). */
  recallDurationMs: number;
}

/** Summary of a single monitoring cycle's results. */
export interface CycleResult {
  /** Context recalled from prior cycles (empty on first run). */
  recalledContext: RecalledContext;
  conditionsChecked: ConditionCheck[];
  proposalsGenerated: DistributionProposal[];
  yieldActions: YieldStrategy[];
  /** Keys of memory entries stored to MemWal during this cycle. */
  memoryStored: string[];
}

/** Agent status and aggregate statistics. */
export interface AgentStatus {
  trustId: string;
  lastCycle: number;
  totalChecks: number;
  totalDistributions: number;
  recentMemories: string[];
}

// ---------------------------------------------------------------------------
// MemWal log helper
// ---------------------------------------------------------------------------

/**
 * Write a memory entry to MemWal and return the entry key.
 * Falls back to console logging if MemWal is not yet connected.
 */
async function writeMemory(
  memwalClient: unknown,
  key: string,
  data: unknown
): Promise<string> {
  const payload = JSON.stringify({ key, timestamp: Date.now(), data });
  console.log(`[TrusteeAgent] Memory → ${key}:`, data);

  if (
    memwalClient != null &&
    typeof (memwalClient as Record<string, unknown>).write === "function"
  ) {
    await (memwalClient as { write: (data: string) => Promise<void> }).write(
      payload
    );
  }

  return key;
}

// ---------------------------------------------------------------------------
// TrusteeAgent class
// ---------------------------------------------------------------------------

/**
 * The AI Trustee Agent for a single Trustea trust fund.
 *
 * Responsibilities:
 * 1. Translate plain English rules into structured TrustRule objects (via Claude)
 * 2. Monitor on-chain and time-based conditions each cycle
 * 3. Propose distributions when conditions are met
 * 4. Recommend DeFi yield strategies based on risk profile
 * 5. Log all decisions to MemWal for verifiable audit trail
 *
 * @example
 * const agent = new TrusteeAgent({
 *   trustId: "0xabc...",
 *   packageId: "0xdef...",
 *   suiClient,
 *   memwalClient,
 *   anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
 * });
 *
 * // During trust setup:
 * const rules = await agent.translateRules([
 *   "Release $50,000 to Alice when she turns 25",
 *   "Distribute 10% annually to Carol",
 * ]);
 *
 * // Recurring monitoring:
 * const result = await agent.runCycle();
 */
export class TrusteeAgent {
  private readonly config: Required<TrusteeAgentConfig>;
  private rules: TrustRule[] = [];
  private lastCycle = 0;
  private totalChecks = 0;
  private totalDistributions = 0;
  private recentMemories: string[] = [];
  private lastDistributions: Map<number, number> = new Map();
  private beneficiaryAddresses: Map<number, string> = new Map();

  constructor(config: TrusteeAgentConfig) {
    this.config = {
      riskProfile: "conservative",
      trustBalance: 0,
      ...config,
    } as Required<TrusteeAgentConfig>;
  }

  // ---------------------------------------------------------------------------
  // Rule management
  // ---------------------------------------------------------------------------

  /**
   * Translate an array of plain English rules and store them on the agent.
   *
   * This should be called once during trust creation. The resulting TrustRule
   * objects are persisted in the agent's state and used for condition monitoring
   * each cycle.
   *
   * @param inputs - Plain English rule strings from the grantor
   * @returns TranslationResult array with rules, explanations, and warnings
   */
  async translateRules(inputs: string[]): Promise<TranslationResult[]> {
    const results = await translateRules(inputs, this.config.anthropicApiKey);

    // Store successfully translated rules
    this.rules = results.map((r) => r.rule);

    // Log the translation to MemWal
    const key = `rule_translation_${Date.now()}`;
    await writeMemory(this.config.memwalClient, key, {
      inputs,
      results: results.map((r) => ({
        ruleType: r.rule.ruleType,
        confidence: r.confidence,
        warnings: r.warnings,
      })),
    });
    this.recentMemories.unshift(key);
    this.recentMemories = this.recentMemories.slice(0, 20);

    return results;
  }

  /**
   * Replace the agent's current rule set with a pre-built array.
   * Use when rules are loaded from on-chain storage rather than translated fresh.
   *
   * @param rules - Pre-built TrustRule objects
   */
  setRules(rules: TrustRule[]): void {
    this.rules = rules;
  }

  /**
   * Map beneficiary addresses to rule indices.
   * Called after trust setup once Sui addresses are known.
   *
   * @param mapping - Map from rule index to Sui address
   */
  setBeneficiaryAddresses(mapping: Map<number, string>): void {
    this.beneficiaryAddresses = mapping;
  }

  // ---------------------------------------------------------------------------
  // Memory recall — the "before" in recall-before-act
  // ---------------------------------------------------------------------------

  /**
   * Query MemWal for relevant past decisions before making new ones.
   *
   * This is the core of the recall-before-act pattern: the agent reviews its
   * own history to make better-informed decisions each cycle. Over time, the
   * agent accumulates context that no single cycle could provide — distribution
   * patterns, recurring condition outcomes, yield performance trends.
   *
   * @returns RecalledContext with past conditions, proposals, and yield decisions
   */
  private async recallContext(): Promise<RecalledContext> {
    const start = Date.now();
    const empty: RecalledContext = {
      pastConditions: [],
      pastProposals: [],
      pastYield: [],
      totalRecalled: 0,
      recallDurationMs: 0,
    };

    // If MemWal is not connected or has no recall method, skip gracefully
    const client = this.config.memwalClient as Record<string, unknown> | null;
    if (
      client == null ||
      typeof client.recallHistory !== "function"
    ) {
      return empty;
    }

    const recall = client.recallHistory as (
      query: string,
      limit?: number,
      namespace?: string,
    ) => Promise<Array<{ text: string; distance: number }>>;

    try {
      // Build recall queries from current rule set for targeted context
      const rulesSummary = this.rules
        .slice(0, 5)
        .map((r) => `${r.ruleType}: ${r.conditionDescription}`)
        .join(", ");

      const trustQuery = `trust ${this.config.trustId} conditions distributions`;
      const rulesQuery = rulesSummary
        ? `condition checks for rules: ${rulesSummary}`
        : trustQuery;

      // Recall in parallel — conditions, proposals, and yield history
      const [pastConditions, pastProposals, pastYield] = await Promise.all([
        recall(rulesQuery, 5, "trustea-decisions").catch(() => []),
        recall(
          `distribution proposals outcomes for trust ${this.config.trustId}`,
          5,
          "trustea-decisions",
        ).catch(() => []),
        recall(
          `yield strategy performance allocation`,
          3,
          "trustea-decisions",
        ).catch(() => []),
      ]);

      const totalRecalled =
        pastConditions.length + pastProposals.length + pastYield.length;

      const result: RecalledContext = {
        pastConditions,
        pastProposals,
        pastYield,
        totalRecalled,
        recallDurationMs: Date.now() - start,
      };

      if (totalRecalled > 0) {
        console.log(
          `[TrusteeAgent] Recalled ${totalRecalled} memories in ${result.recallDurationMs}ms ` +
            `(${pastConditions.length} conditions, ${pastProposals.length} proposals, ${pastYield.length} yield)`
        );
      }

      return result;
    } catch (err) {
      console.warn("[TrusteeAgent] Memory recall failed (non-fatal):", err);
      return { ...empty, recallDurationMs: Date.now() - start };
    }
  }

  // ---------------------------------------------------------------------------
  // Main monitoring cycle
  // ---------------------------------------------------------------------------

  /**
   * Run one complete monitoring cycle.
   *
   * Steps:
   * 0. **Recall** — Query MemWal for past decisions relevant to current rules
   * 1. Check all rule conditions (time, credential, periodic)
   * 2. Generate distribution proposals for triggered conditions
   * 3. Build yield strategy recommendations for idle balance
   * 4. Log everything to MemWal (including recall context for audit)
   *
   * The recall-before-act pattern means the agent gets smarter over time:
   * early cycles have no history, but after days/weeks the agent references
   * past distribution patterns, condition outcomes, and yield performance
   * to make better-informed decisions.
   *
   * @returns Summary of what happened this cycle
   */
  async runCycle(): Promise<CycleResult> {
    const now = Date.now();
    const memoryStored: string[] = [];

    console.log(
      `[TrusteeAgent] Starting cycle for trust ${this.config.trustId} at ${new Date(now).toISOString()}`
    );

    if (this.rules.length === 0) {
      console.warn(
        "[TrusteeAgent] No rules loaded — call translateRules() or setRules() first."
      );
    }

    // ------------------------------------------------------------------
    // Step 0: Recall past decisions from MemWal
    // ------------------------------------------------------------------
    const recalledContext = await this.recallContext();

    // Enrich the cycle log with historical context so future recalls
    // can see what the agent knew at decision time.
    if (recalledContext.totalRecalled > 0) {
      const recallKey = `memory_recall_${now}`;
      await writeMemory(this.config.memwalClient, recallKey, {
        trustId: this.config.trustId,
        recalled: recalledContext.totalRecalled,
        durationMs: recalledContext.recallDurationMs,
        // Store summaries of what was recalled so future cycles see the chain
        conditionHistory: recalledContext.pastConditions.map((m) => m.text).slice(0, 3),
        proposalHistory: recalledContext.pastProposals.map((m) => m.text).slice(0, 3),
        yieldHistory: recalledContext.pastYield.map((m) => m.text).slice(0, 2),
      });
      memoryStored.push(recallKey);
    }

    // ------------------------------------------------------------------
    // Step 1: Check conditions (enriched by recalled context)
    // ------------------------------------------------------------------
    const conditionsChecked = await checkConditions({
      trustId: this.config.trustId,
      rules: this.rules,
      suiClient: this.config.suiClient,
      currentTime: now,
      lastDistributions: this.lastDistributions,
      beneficiaryAddresses: this.beneficiaryAddresses,
    });

    this.totalChecks += conditionsChecked.length;

    const conditionKey = `condition_check_${now}`;
    // Store condition results with historical context for richer future recall
    const conditionPayload: Record<string, unknown> = {
      trustId: this.config.trustId,
      checks: conditionsChecked,
      cycleNumber: this.totalChecks + conditionsChecked.length,
    };
    // If we recalled past conditions, note them alongside current results
    // so future recall queries see the decision chain
    if (recalledContext.pastConditions.length > 0) {
      conditionPayload.informedBy = recalledContext.pastConditions.length + " prior memories";
      conditionPayload.priorContext = recalledContext.pastConditions
        .slice(0, 2)
        .map((m) => m.text.slice(0, 200));
    }
    await writeMemory(this.config.memwalClient, conditionKey, conditionPayload);
    memoryStored.push(conditionKey);

    // ------------------------------------------------------------------
    // Step 2: Generate distribution proposals
    // ------------------------------------------------------------------
    const proposalsGenerated = await generateProposals({
      trustId: this.config.trustId,
      conditionChecks: conditionsChecked,
      rules: this.rules,
      trustBalance: this.config.trustBalance,
    });

    if (proposalsGenerated.length > 0) {
      this.totalDistributions += proposalsGenerated.length;

      const proposalKey = `distribution_proposals_${now}`;
      const proposalPayload: Record<string, unknown> = {
        trustId: this.config.trustId,
        proposals: proposalsGenerated,
      };
      // Reference past proposals so the agent can track distribution patterns over time
      if (recalledContext.pastProposals.length > 0) {
        proposalPayload.priorProposals = recalledContext.pastProposals.length;
        proposalPayload.priorContext = recalledContext.pastProposals
          .slice(0, 2)
          .map((m) => m.text.slice(0, 200));
      }
      await writeMemory(this.config.memwalClient, proposalKey, proposalPayload);
      memoryStored.push(proposalKey);

      console.log(
        `[TrusteeAgent] Generated ${proposalsGenerated.length} distribution proposal(s)` +
          (recalledContext.pastProposals.length > 0
            ? ` (informed by ${recalledContext.pastProposals.length} prior proposals).`
            : ".")
      );
    }

    // ------------------------------------------------------------------
    // Step 3: Yield strategy recommendations
    // ------------------------------------------------------------------
    const currentAllocations: Array<{ protocol: string; amount: number }> = [];

    const yieldActions = await getYieldStrategy({
      balance: this.config.trustBalance,
      riskProfile: this.config.riskProfile,
      currentAllocations,
    });

    if (yieldActions.length > 0) {
      for (const action of yieldActions) {
        await logYieldAction(action, this.config.memwalClient);
      }

      const yieldKey = `yield_strategy_${now}`;
      await writeMemory(this.config.memwalClient, yieldKey, {
        trustId: this.config.trustId,
        riskProfile: this.config.riskProfile,
        strategies: yieldActions,
      });
      memoryStored.push(yieldKey);
    }

    // ------------------------------------------------------------------
    // Step 4: Update cycle state
    // ------------------------------------------------------------------
    this.lastCycle = now;

    // Track last distribution timestamps for periodic condition checks
    for (const proposal of proposalsGenerated) {
      this.lastDistributions.set(proposal.ruleIndex, now);
    }

    this.recentMemories.unshift(...memoryStored);
    this.recentMemories = this.recentMemories.slice(0, 20);

    // ------------------------------------------------------------------
    // Step 5: Store a cycle summary for efficient future recall
    // ------------------------------------------------------------------
    // This single memory entry captures the entire cycle in natural language,
    // making future semantic recall more effective than querying raw data.
    const metCount = conditionsChecked.filter((c) => c.conditionMet).length;
    const summaryParts = [
      `Cycle at ${new Date(now).toISOString()} for trust ${this.config.trustId}.`,
      `Checked ${conditionsChecked.length} conditions: ${metCount} met, ${conditionsChecked.length - metCount} not met.`,
    ];
    if (proposalsGenerated.length > 0) {
      const totalAmount = proposalsGenerated.reduce((s, p) => s + p.amount, 0);
      summaryParts.push(
        `Generated ${proposalsGenerated.length} proposals totaling ${totalAmount} MIST.`
      );
    }
    if (yieldActions.length > 0) {
      summaryParts.push(
        `Yield: ${yieldActions.map((a) => `${a.protocol} ${a.action}`).join(", ")}.`
      );
    }
    if (recalledContext.totalRecalled > 0) {
      summaryParts.push(
        `Informed by ${recalledContext.totalRecalled} prior memories (${recalledContext.recallDurationMs}ms recall).`
      );
    }

    const summaryKey = `cycle_summary_${now}`;
    await writeMemory(
      this.config.memwalClient,
      summaryKey,
      summaryParts.join(" ")
    );
    memoryStored.push(summaryKey);

    console.log(
      `[TrusteeAgent] Cycle complete: ${conditionsChecked.length} checks, ` +
        `${proposalsGenerated.length} proposals, ${yieldActions.length} yield actions` +
        (recalledContext.totalRecalled > 0
          ? `, recalled ${recalledContext.totalRecalled} memories.`
          : ".")
    );

    return {
      recalledContext,
      conditionsChecked,
      proposalsGenerated,
      yieldActions,
      memoryStored,
    };
  }

  // ---------------------------------------------------------------------------
  // Distribution execution
  // ---------------------------------------------------------------------------

  /**
   * Build a Sui transaction to execute an approved distribution.
   *
   * The proposal must be in "approved" status and past its veto window before
   * calling this. Returns an unsigned Transaction for the agent's keypair to sign.
   *
   * @param proposal               An approved DistributionProposal.
   * @param distributionObjectId   On-chain PendingDistribution shared object ID
   *                               returned by the `propose_distribution` call.
   * @returns Unsigned Sui Transaction
   * @throws If the proposal is not approved or veto window hasn't expired
   */
  buildDistributionTx(
    proposal: DistributionProposal,
    distributionObjectId: string
  ) {
    if (!isVetoWindowExpired(proposal, Date.now())) {
      const windowDays = proposal.overridePeriodMs / 86400000;
      throw new Error(
        `Proposal ${proposal.id} is still within the ${windowDays}-day veto window. Cannot execute yet.`
      );
    }
    return buildDistributionTx(proposal, distributionObjectId, this.config.packageId);
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  /**
   * Return the agent's current status and aggregate statistics.
   */
  async getStatus(): Promise<AgentStatus> {
    return {
      trustId: this.config.trustId,
      lastCycle: this.lastCycle,
      totalChecks: this.totalChecks,
      totalDistributions: this.totalDistributions,
      recentMemories: this.recentMemories.slice(0, 10),
    };
  }

  /**
   * Manually trigger a recall query for debugging or demonstration.
   * Shows what the agent would remember before its next cycle.
   *
   * @param query - Natural language query to search MemWal
   * @param limit - Max results (default 5)
   * @returns Array of recalled memories with distance scores
   */
  async debugRecall(
    query: string,
    limit = 5,
  ): Promise<Array<{ text: string; distance: number }>> {
    const client = this.config.memwalClient as Record<string, unknown> | null;
    if (client == null || typeof client.recallHistory !== "function") {
      return [];
    }
    const recall = client.recallHistory as (
      q: string,
      l?: number,
    ) => Promise<Array<{ text: string; distance: number }>>;
    return recall(query, limit);
  }
}

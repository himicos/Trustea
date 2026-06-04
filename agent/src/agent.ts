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

/** Summary of a single monitoring cycle's results. */
export interface CycleResult {
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
  // Main monitoring cycle
  // ---------------------------------------------------------------------------

  /**
   * Run one complete monitoring cycle.
   *
   * Steps:
   * 1. Check all rule conditions (time, credential, periodic)
   * 2. Generate distribution proposals for triggered conditions
   * 3. Build yield strategy recommendations for idle balance
   * 4. Log everything to MemWal
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
    // Step 1: Check conditions
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
    await writeMemory(this.config.memwalClient, conditionKey, {
      trustId: this.config.trustId,
      checks: conditionsChecked,
    });
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
      await writeMemory(this.config.memwalClient, proposalKey, {
        trustId: this.config.trustId,
        proposals: proposalsGenerated,
      });
      memoryStored.push(proposalKey);

      console.log(
        `[TrusteeAgent] Generated ${proposalsGenerated.length} distribution proposal(s).`
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

    console.log(
      `[TrusteeAgent] Cycle complete: ${conditionsChecked.length} checks, ${proposalsGenerated.length} proposals, ${yieldActions.length} yield actions.`
    );

    return {
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
}

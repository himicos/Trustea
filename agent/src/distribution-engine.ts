/**
 * Distribution Engine
 *
 * Generates distribution proposals when trust conditions are met and builds
 * Sui PTB transactions to execute approved distributions on-chain via the
 * Trustea smart contract.
 */

import { Transaction } from "@mysten/sui/transactions";
import type { TrustRule } from "./rule-translator.js";
import type { ConditionCheck } from "./condition-monitor.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Lifecycle states of a distribution proposal. */
export type ProposalStatus = "proposed" | "approved" | "executed" | "vetoed";

/** A proposed distribution of funds from a trust to a beneficiary. */
export interface DistributionProposal {
  /** Unique proposal ID (generated locally). */
  id: string;
  /** Object ID of the on-chain trust. */
  trustId: string;
  /** Sui address of the recipient beneficiary. */
  beneficiary: string;
  /** Dollar amount to distribute. */
  amount: number;
  /** Index of the triggering rule in the trust's rule array. */
  ruleIndex: number;
  /** Human-readable reason for the proposal. */
  reason: string;
  /** Unix timestamp (ms) when proposal was generated. */
  proposedAt: number;
  /**
   * Veto window in milliseconds. Grantor may reject within this period.
   * Default: 7 days (604800000 ms).
   */
  overridePeriodMs: number;
  /** Current lifecycle status. */
  status: ProposalStatus;
}

/** Parameters for generating distribution proposals. */
export interface GenerateProposalsParams {
  trustId: string;
  conditionChecks: ConditionCheck[];
  rules: TrustRule[];
  /** Current trust balance in dollars. */
  trustBalance: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_OVERRIDE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate a simple unique proposal ID.
 */
function generateProposalId(
  trustId: string,
  ruleIndex: number,
  proposedAt: number
): string {
  return `${trustId.slice(0, 8)}-r${ruleIndex}-${proposedAt}`;
}

/**
 * Resolve the dollar amount for a proposal from a rule and current trust balance.
 *
 * @param rule - The triggered rule
 * @param trustBalance - Current balance in dollars
 * @returns Resolved dollar amount (0 if balance insufficient for percentage calculation)
 */
function resolveAmount(rule: TrustRule, trustBalance: number): number {
  if (rule.isPercentage) {
    return Math.floor((rule.amount / 100) * trustBalance);
  }
  return rule.amount;
}

/**
 * Build a human-readable reason string for a proposal.
 */
function buildReason(rule: TrustRule, check: ConditionCheck): string {
  const who = rule.beneficiary ?? `beneficiary ${check.beneficiary.slice(0, 8)}`;
  const what = rule.isPercentage
    ? `${rule.amount}% of trust balance`
    : `$${rule.amount.toLocaleString()}`;
  return `Rule #${check.ruleIndex} (${rule.ruleType}): distribute ${what} to ${who}. Condition: ${rule.conditionDescription}.`;
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

/**
 * Generate distribution proposals for all conditions that are currently met.
 *
 * Only generates proposals for rules whose conditions are satisfied and where
 * the trust has sufficient balance. Each proposal enters the "proposed" state
 * and must pass the override window before execution.
 *
 * @param params - Trust ID, condition checks, rules, and current balance
 * @returns Array of proposals ready for grantor review
 */
export async function generateProposals(
  params: GenerateProposalsParams
): Promise<DistributionProposal[]> {
  const { trustId, conditionChecks, rules, trustBalance } = params;
  const proposals: DistributionProposal[] = [];
  const now = Date.now();

  for (const check of conditionChecks) {
    if (!check.conditionMet) continue;

    const rule = rules[check.ruleIndex];
    if (!rule) continue;

    const amount = resolveAmount(rule, trustBalance);

    // Skip proposals where the resolved amount is zero (edge case: 0% or 0 fixed)
    if (amount <= 0) {
      console.warn(
        `[DistributionEngine] Skipping rule #${check.ruleIndex}: resolved amount is 0.`
      );
      continue;
    }

    // Conservative check: don't propose if trust can't cover the amount
    if (amount > trustBalance) {
      console.warn(
        `[DistributionEngine] Skipping rule #${check.ruleIndex}: amount $${amount} exceeds balance $${trustBalance}.`
      );
      continue;
    }

    proposals.push({
      id: generateProposalId(trustId, check.ruleIndex, now),
      trustId,
      beneficiary: check.beneficiary,
      amount,
      ruleIndex: check.ruleIndex,
      reason: buildReason(rule, check),
      proposedAt: now,
      overridePeriodMs: DEFAULT_OVERRIDE_PERIOD_MS,
      status: "proposed",
    });
  }

  return proposals;
}

/**
 * Build a Sui Programmable Transaction Block to execute a distribution.
 *
 * Calls the Trustea smart contract's `execute_distribution` entry function.
 *
 * Contract signature:
 *   execute_distribution(trust: &mut Trust, dist: &mut PendingDistribution,
 *                        clock: &Clock, ctx: &mut TxContext)
 *
 * The PendingDistribution object ID must be obtained from the on-chain
 * `DistributionProposed` event emitted by `propose_distribution`. It is a
 * shared object created by that call.
 *
 * @param proposal               An approved distribution proposal.
 * @param distributionObjectId   On-chain PendingDistribution shared object ID.
 * @param packageId              Deployed Trustea package ID on Sui.
 * @returns Unsigned Sui Transaction ready for signing by the agent keypair.
 */
export function buildDistributionTx(
  proposal: DistributionProposal,
  distributionObjectId: string,
  packageId: string
): Transaction {
  if (proposal.status !== "approved") {
    throw new Error(
      `Cannot execute proposal ${proposal.id}: status is "${proposal.status}", expected "approved".`
    );
  }

  const CLOCK_OBJECT_ID = "0x6";

  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::trust::execute_distribution`,
    arguments: [
      tx.object(proposal.trustId),
      tx.object(distributionObjectId),
      tx.object(CLOCK_OBJECT_ID),
    ],
  });

  return tx;
}

/**
 * Check whether a proposal's override (veto) window has expired.
 *
 * @param proposal - The proposal to check
 * @param currentTime - Current Unix timestamp in milliseconds
 * @returns true if the veto window has closed and execution may proceed
 */
export function isVetoWindowExpired(
  proposal: DistributionProposal,
  currentTime: number
): boolean {
  return currentTime >= proposal.proposedAt + proposal.overridePeriodMs;
}

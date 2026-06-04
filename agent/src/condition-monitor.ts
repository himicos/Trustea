/**
 * Condition Monitor
 *
 * Monitors on-chain and time-based state to determine whether trust distribution
 * conditions are met. Time and periodic checks work immediately; credential checks
 * query Sui for NFT ownership.
 */

import type { CoreClient } from "@mysten/sui/client";
import type { TrustRule } from "./rule-translator.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Sui address string (0x-prefixed hex). */
type address = string;

/** Result of evaluating a single rule's condition. */
export interface ConditionCheck {
  /** Index of the rule in the trust's rule array. */
  ruleIndex: number;
  /** Beneficiary address this check was performed for. */
  beneficiary: address;
  /** Whether the condition is currently satisfied. */
  conditionMet: boolean;
  /** Human-readable detail explaining the check outcome. */
  details: string;
  /** Unix timestamp (ms) when this check was performed. */
  checkedAt: number;
}

/** Parameters passed to the main checkConditions function. */
export interface CheckConditionsParams {
  trustId: string;
  rules: TrustRule[];
  suiClient: CoreClient;
  /** Current time as Unix timestamp in milliseconds. */
  currentTime: number;
  /**
   * Map from rule index → last distribution timestamp (ms).
   * Used for periodic rule evaluation.
   */
  lastDistributions?: Map<number, number>;
  /**
   * Map from rule index → beneficiary address override.
   * If absent the rule's beneficiary field is used (as a placeholder address).
   */
  beneficiaryAddresses?: Map<number, address>;
}

// ---------------------------------------------------------------------------
// Individual condition checkers
// ---------------------------------------------------------------------------

/**
 * Check whether a time-based or age-based condition is currently met.
 * Both rule types use conditionParams.timestamp — the point in time at or after
 * which the condition becomes true.
 *
 * @param rule - The trust rule to evaluate
 * @param currentTime - Current Unix timestamp in milliseconds
 * @returns true if the timestamp has been reached
 */
export function checkTimeCondition(
  rule: TrustRule,
  currentTime: number
): boolean {
  const { timestamp } = rule.conditionParams;
  if (timestamp == null) {
    // No timestamp means we cannot evaluate — treat as not met
    return false;
  }
  return currentTime >= timestamp;
}

/**
 * Check whether a beneficiary holds the required credential NFT on Sui.
 *
 * Queries the beneficiary's owned objects and looks for an object whose type
 * contains the nftType identifier from the rule. Uses a simple substring match
 * against the object's fully-qualified Move type.
 *
 * @param rule - The trust rule containing conditionParams.nftType
 * @param beneficiary - Sui address of the beneficiary
 * @param suiClient - Connected CoreClient instance
 * @returns true if the credential condition is satisfied
 *
 * TODO Phase 2: integrate Trustea's on-chain credential registry for more
 * precise type matching once the credential module is deployed.
 */
export async function checkCredentialCondition(
  rule: TrustRule,
  beneficiary: address,
  suiClient: CoreClient
): Promise<boolean> {
  const { nftType, negativeCheck } = rule.conditionParams;

  if (!nftType) {
    // No NFT type specified — cannot evaluate
    return false;
  }

  try {
    // Fetch all objects owned by the beneficiary using the new Sui SDK API
    const ownedObjects = await suiClient.listOwnedObjects({
      owner: beneficiary,
      type: nftType,
    });

    // Check if any returned object type matches the credential identifier
    const hasCredential = ownedObjects.objects.some((obj) => {
      const objType = obj.type ?? "";
      return objType.toLowerCase().includes(nftType.toLowerCase());
    });

    // Negative check: rule triggers when the credential is ABSENT (e.g., no criminal record)
    if (negativeCheck === true) {
      return !hasCredential;
    }

    return hasCredential;
  } catch (err) {
    // Network or RPC errors — log and treat as not met (conservative approach)
    console.error(
      `[ConditionMonitor] Failed to check credential for ${beneficiary}:`,
      err
    );
    return false;
  }
}

/**
 * Check whether a periodic distribution is due.
 *
 * A periodic condition is met when the time elapsed since the last distribution
 * exceeds the rule's period. If no previous distribution has occurred, the
 * condition is immediately met.
 *
 * @param rule - The trust rule containing conditionParams.periodMs
 * @param lastDistribution - Unix timestamp (ms) of the last distribution, or 0 if none
 * @param currentTime - Current Unix timestamp in milliseconds
 * @returns true if a distribution is now due
 */
export function checkPeriodicCondition(
  rule: TrustRule,
  lastDistribution: number,
  currentTime: number
): boolean {
  const { periodMs } = rule.conditionParams;

  if (periodMs == null || periodMs <= 0) {
    return false;
  }

  // No prior distribution → first distribution is immediately due
  if (lastDistribution === 0) {
    return true;
  }

  return currentTime - lastDistribution >= periodMs;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Evaluate all conditions for a trust, returning one ConditionCheck per rule.
 *
 * Dispatches to the appropriate checker based on rule type:
 * - age / time → checkTimeCondition
 * - credential → checkCredentialCondition (async Sui query)
 * - periodic → checkPeriodicCondition
 * - custom → always false (requires manual review)
 *
 * @param params - Trust ID, rules array, Sui client, and current time
 * @returns Array of ConditionCheck objects, one per rule
 */
export async function checkConditions(
  params: CheckConditionsParams
): Promise<ConditionCheck[]> {
  const {
    rules,
    suiClient,
    currentTime,
    lastDistributions = new Map(),
    beneficiaryAddresses = new Map(),
  } = params;

  const results: ConditionCheck[] = [];

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];

    // Resolve beneficiary address: prefer explicit map, fall back to rule field as placeholder
    const beneficiary =
      beneficiaryAddresses.get(i) ??
      rule.beneficiary ??
      "0x0000000000000000000000000000000000000000000000000000000000000000";

    let conditionMet = false;
    let details = "";

    switch (rule.ruleType) {
      case "age":
      case "time": {
        conditionMet = checkTimeCondition(rule, currentTime);
        const { timestamp } = rule.conditionParams;

        if (timestamp == null) {
          details = `${rule.ruleType} condition: no timestamp configured — cannot evaluate.`;
        } else {
          const targetDate = new Date(timestamp).toISOString();
          const now = new Date(currentTime).toISOString();
          details = conditionMet
            ? `${rule.ruleType} condition MET: target ${targetDate} has passed (now ${now}).`
            : `${rule.ruleType} condition NOT MET: target ${targetDate} not yet reached (now ${now}).`;
        }
        break;
      }

      case "credential": {
        conditionMet = await checkCredentialCondition(
          rule,
          beneficiary,
          suiClient
        );
        const { nftType, negativeCheck } = rule.conditionParams;
        const checkMode = negativeCheck ? "absence of" : "presence of";
        details = conditionMet
          ? `Credential condition MET: ${checkMode} "${nftType}" confirmed for ${beneficiary}.`
          : `Credential condition NOT MET: ${checkMode} "${nftType}" not confirmed for ${beneficiary}.`;
        break;
      }

      case "periodic": {
        const lastDist = lastDistributions.get(i) ?? 0;
        conditionMet = checkPeriodicCondition(rule, lastDist, currentTime);
        const { periodMs } = rule.conditionParams;
        const periodDays =
          periodMs != null ? Math.round(periodMs / 86400000) : "?";

        if (lastDist === 0) {
          details = conditionMet
            ? `Periodic condition MET: no prior distribution — first ${periodDays}-day cycle is due.`
            : `Periodic condition NOT MET: no period configured.`;
        } else {
          const elapsed = currentTime - lastDist;
          const elapsedDays = Math.round(elapsed / 86400000);
          details = conditionMet
            ? `Periodic condition MET: ${elapsedDays}d elapsed since last distribution (period: ${periodDays}d).`
            : `Periodic condition NOT MET: only ${elapsedDays}d elapsed of ${periodDays}d required.`;
        }
        break;
      }

      case "custom":
      default: {
        // Custom rules require manual trustee review — agent flags but does not auto-trigger
        conditionMet = false;
        details = `Custom rule requires manual review: "${rule.conditionParams.customLogic ?? rule.conditionDescription}"`;
        break;
      }
    }

    results.push({
      ruleIndex: i,
      beneficiary,
      conditionMet,
      details,
      checkedAt: currentTime,
    });
  }

  return results;
}

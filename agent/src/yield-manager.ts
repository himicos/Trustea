/**
 * Yield Manager
 *
 * Manages trust funds in DeFi protocols based on the grantor's risk tolerance.
 * This module is intentionally stubbed for Phase 1 — the interface is stable
 * and real Scallop/NAVI integration will be added in Phase 3.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Grantor-selected risk level governing DeFi allocation strategy. */
export type RiskProfile = "passive" | "conservative" | "moderate" | "aggressive";

/** A recommended action for the yield management layer. */
export interface YieldStrategy {
  /** DeFi protocol name (e.g., "Scallop", "NAVI", "DeepBook"). */
  protocol: string;
  /** What to do with the funds. */
  action: "deposit" | "withdraw" | "rebalance";
  /** Dollar amount to move. */
  amount: number;
  /** Expected annual percentage yield at time of recommendation. */
  expectedApy: number;
  /** Risk score 1–10 (1 = safest, 10 = most speculative). */
  riskScore: number;
}

/** Current allocation in a single DeFi protocol. */
export interface ProtocolAllocation {
  protocol: string;
  amount: number;
}

/** Parameters for getting a yield strategy recommendation. */
export interface GetYieldStrategyParams {
  /** Current idle (undeployed) trust balance in dollars. */
  balance: number;
  /** Trust's risk profile. */
  riskProfile: RiskProfile;
  /** Currently deployed allocations across protocols. */
  currentAllocations: ProtocolAllocation[];
}

// ---------------------------------------------------------------------------
// Strategy catalogue
// ---------------------------------------------------------------------------

/**
 * Static strategy definitions per risk profile.
 *
 * Phase 3 will replace these with live APY data from Scallop/NAVI SDKs.
 */
const STRATEGY_CATALOGUE: Record<RiskProfile, YieldStrategy[]> = {
  passive: [
    {
      protocol: "SUI Staking",
      action: "deposit",
      amount: 0, // resolved at runtime
      expectedApy: 4.5,
      riskScore: 1,
    },
  ],
  conservative: [
    {
      protocol: "Scallop",
      action: "deposit",
      amount: 0,
      expectedApy: 6.0,
      riskScore: 2,
    },
    {
      protocol: "SUI Staking",
      action: "deposit",
      amount: 0,
      expectedApy: 4.5,
      riskScore: 1,
    },
  ],
  moderate: [
    {
      protocol: "NAVI",
      action: "deposit",
      amount: 0,
      expectedApy: 8.5,
      riskScore: 4,
    },
    {
      protocol: "Scallop",
      action: "deposit",
      amount: 0,
      expectedApy: 6.0,
      riskScore: 2,
    },
  ],
  aggressive: [
    {
      protocol: "NAVI",
      action: "deposit",
      amount: 0,
      expectedApy: 12.0,
      riskScore: 7,
    },
    {
      protocol: "DeepBook LP",
      action: "deposit",
      amount: 0,
      expectedApy: 18.0,
      riskScore: 8,
    },
    {
      protocol: "Scallop",
      action: "deposit",
      amount: 0,
      expectedApy: 6.0,
      riskScore: 2,
    },
  ],
};

/** Allocation split ratios (must sum to 1.0) per profile. */
const ALLOCATION_RATIOS: Record<RiskProfile, number[]> = {
  passive:       [1.0],
  conservative:  [0.6, 0.4],
  moderate:      [0.6, 0.4],
  aggressive:    [0.5, 0.3, 0.2],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the total currently deployed amount across all protocols.
 */
function totalDeployed(allocations: ProtocolAllocation[]): number {
  return allocations.reduce((sum, a) => sum + a.amount, 0);
}

/**
 * Determine if rebalancing is needed based on current vs. target allocations.
 * Returns true if any protocol is >10% away from its target ratio.
 */
function needsRebalance(
  currentAllocations: ProtocolAllocation[],
  targets: YieldStrategy[]
): boolean {
  if (currentAllocations.length === 0) return false;
  const total = totalDeployed(currentAllocations);
  if (total === 0) return false;

  for (const target of targets) {
    const current = currentAllocations.find(
      (a) => a.protocol === target.protocol
    );
    const currentShare = current != null ? current.amount / total : 0;
    const targetShare = target.amount / targets.reduce((s, t) => s + t.amount, 0);
    if (Math.abs(currentShare - targetShare) > 0.1) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

/**
 * Get yield strategy recommendations for a trust based on its risk profile.
 *
 * Distributes the idle balance across protocols according to the risk profile's
 * target allocation ratios. If there are existing allocations that are out of
 * balance, rebalance actions are added.
 *
 * STUB: APY figures and protocol list are hardcoded. Phase 3 will fetch live
 * data from Scallop Finance SDK and NAVI Protocol SDK.
 *
 * @param params - Current balance, risk profile, and existing allocations
 * @returns Ordered list of recommended yield actions
 */
export async function getYieldStrategy(
  params: GetYieldStrategyParams
): Promise<YieldStrategy[]> {
  const { balance, riskProfile, currentAllocations } = params;

  const catalogue = STRATEGY_CATALOGUE[riskProfile];
  const ratios = ALLOCATION_RATIOS[riskProfile];
  const strategies: YieldStrategy[] = [];

  // If there's idle balance to deploy, create deposit actions
  if (balance > 0) {
    for (let i = 0; i < catalogue.length; i++) {
      const template = catalogue[i];
      const ratio = ratios[i] ?? 0;
      const allocationAmount = Math.floor(balance * ratio);

      if (allocationAmount <= 0) continue;

      strategies.push({
        ...template,
        amount: allocationAmount,
        action: "deposit",
      });
    }
  }

  // Check if existing allocations need rebalancing
  if (currentAllocations.length > 0 && needsRebalance(currentAllocations, strategies)) {
    const totalCurrent = totalDeployed(currentAllocations);

    for (let i = 0; i < catalogue.length; i++) {
      const template = catalogue[i];
      const ratio = ratios[i] ?? 0;
      const targetAmount = Math.floor(totalCurrent * ratio);
      const currentProtocol = currentAllocations.find(
        (a) => a.protocol === template.protocol
      );
      const currentAmount = currentProtocol?.amount ?? 0;

      if (Math.abs(currentAmount - targetAmount) > 100) {
        strategies.push({
          ...template,
          action: "rebalance",
          amount: targetAmount,
        });
      }
    }
  }

  return strategies;
}

/**
 * Log a yield action to MemWal for persistent audit trail.
 *
 * STUB: memwalClient interface will be defined once @mysten-incubation/memwal
 * publishes stable types. Currently writes a JSON log entry.
 *
 * @param action - The yield strategy action that was taken
 * @param memwalClient - Connected MemWal client instance
 *
 * TODO Phase 3: Replace with actual MemWal SDK write call.
 */
export async function logYieldAction(
  action: YieldStrategy,
  memwalClient: unknown
): Promise<void> {
  const entry = {
    type: "yield_action",
    timestamp: Date.now(),
    protocol: action.protocol,
    actionType: action.action,
    amount: action.amount,
    expectedApy: action.expectedApy,
    riskScore: action.riskScore,
  };

  // TODO Phase 3: use memwalClient.write(JSON.stringify(entry)) once types are stable
  console.log("[YieldManager] Logging yield action to MemWal:", entry);

  if (
    memwalClient != null &&
    typeof (memwalClient as Record<string, unknown>).write === "function"
  ) {
    await (memwalClient as { write: (data: string) => Promise<void> }).write(
      JSON.stringify(entry)
    );
  }
}

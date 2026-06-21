// Demo polish — query param ?demo=1 (also persists for the session via sessionStorage).
// Reads cleanly in SSR (returns false). Pure UX layer: never changes chain interactions.

const SS_KEY = "trustea-demo-mode";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("demo") === "1") {
    try {
      sessionStorage.setItem(SS_KEY, "1");
    } catch {}
    return true;
  }
  if (params.get("demo") === "0") {
    try {
      sessionStorage.removeItem(SS_KEY);
    } catch {}
    return false;
  }
  try {
    return sessionStorage.getItem(SS_KEY) === "1";
  } catch {
    return false;
  }
}

// Rich seed memories — used when MemWal recall returns empty in demo mode.
// Written to feel like real agent cycles from a five-year-old trust.
export const DEMO_RECALL_MEMORIES = [
  {
    namespace: "trustea-decisions",
    text: "Cycle 142 · Alice's monthly stipend approved (100 SUI). Enrollment credential verified on-chain via university_enrollment NFT. Recalled 18 prior approvals — consistent pattern, no anomaly. Proposal auto-executed after 48h veto window closed.",
    distance: 0.08,
  },
  {
    namespace: "trustea-decisions",
    text: "Cycle 138 · Bob requested $5k discretionary distribution citing medical expenses (HEMS category: health). Recalled 3 prior health requests, all approved by grantor within 12h. Forwarded request with summary; grantor approved in 4h.",
    distance: 0.14,
  },
  {
    namespace: "trustea-events",
    text: "Cycle 127 · Pattern detected: Alice's enrollment credential expired during summer term. Held distribution, alerted grantor. Grantor confirmed academic break, manually overrode for that month. Memory: don't auto-flag June/July enrollment gaps for this trust.",
    distance: 0.21,
  },
  {
    namespace: "trustea-decisions",
    text: "Cycle 119 · Compound rule fired: graduation credential AND age ≥ 21. All conditions met. Proposed lump-sum distribution of 25k SUI. Grantor vetoed, citing 'still in grad school, defer 2 years.' Updated internal note for future similar patterns.",
    distance: 0.27,
  },
  {
    namespace: "trustea-events",
    text: "Cycle 103 · Beneficiary NFT minted for Bob (soulbound). Updated rule set to include new HEMS category. Recall context: grantor's intent throughout history has been health-priority distributions during medical emergencies.",
    distance: 0.34,
  },
] as const;

/** Synthetic AI translation used in demo mode so the wizard works without the external API. */
export function getDemoRuleTranslation(text: string) {
  const lower = text.toLowerCase();
  const amountMatch = text.match(/\b(\d+(?:\.\d+)?)\s*SUI\b/i);
  const pctMatch = text.match(/\b(\d+(?:\.\d+)?)%/);
  const isPercentage = !!pctMatch;
  const amount = isPercentage
    ? parseFloat(pctMatch![1])
    : amountMatch
      ? parseFloat(amountMatch[1])
      : 100;

  if (/\bturn(?:s)?\s+\d+\b|age\s*\d+/i.test(lower)) {
    const ageMatch = lower.match(/\bturn(?:s)?\s+(\d+)\b|age\s*(\d+)/);
    const age = parseInt(ageMatch?.[1] ?? ageMatch?.[2] ?? "25");
    const timestamp = Math.round(Date.now() + age * 365.25 * 24 * 60 * 60 * 1000);
    return {
      rule: {
        ruleType: "age",
        amount,
        isPercentage,
        conditionDescription: `Beneficiary reaches age ${age}`,
        conditionParams: { timestamp },
      },
      explanation: `Release ${isPercentage ? amount + "%" : amount + " SUI"} when the beneficiary reaches age ${age}.`,
      confidence: 0.93,
      warnings: [] as string[],
    };
  }

  const periodMs = /annual|year|yearly/i.test(lower)
    ? 365 * 24 * 60 * 60 * 1000
    : 30 * 24 * 60 * 60 * 1000;
  const periodLabel = periodMs === 365 * 24 * 60 * 60 * 1000 ? "annual" : "monthly";

  return {
    rule: {
      ruleType: "periodic",
      amount,
      isPercentage,
      conditionDescription: `${periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)} distribution`,
      conditionParams: { periodMs },
    },
    explanation: `Distribute ${isPercentage ? amount + "%" : amount + " SUI"} on a recurring ${periodLabel} basis.`,
    confidence: 0.91,
    warnings: [] as string[],
  };
}

// Default placeholder for the wizard rule input (real placeholder stays the same,
// but in demo mode we pre-populate the text box).
export const DEMO_RULE_SUGGESTIONS = [
  "Release 100 SUI to Alice every month while she is enrolled in university",
  "Distribute 10% annually to Carol after she turns 25, capped at 50000 SUI per year",
  "Pay tuition for Bob if enrolled, suspend if convicted of a felony",
];

/**
 * Trustea — UI helper utilities.
 *
 * Pure functions consumed by the frontend for formatting, progress
 * computation, countdowns, and aggregate stats. No side effects,
 * no network calls — those live in trust-reader.ts.
 *
 * @module @trustea/lib/helpers
 */

import type { RuleState, TrustState, PendingDistributionState } from "./trust-reader.js";

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** SUI decimal places (1 SUI = 1_000_000_000 MIST). */
const MIST_PER_SUI = 1_000_000_000n;

/**
 * Format a MIST amount as a human-readable SUI string.
 *
 * @example
 * formatSui(1_500_000_000n)  // "1.5 SUI"
 * formatSui(500_000n)        // "0.0005 SUI"
 * formatSui(0n)              // "0 SUI"
 */
export function formatSui(mist: bigint): string {
  if (mist === 0n) return "0 SUI";

  const whole = mist / MIST_PER_SUI;
  const remainder = mist % MIST_PER_SUI;

  if (remainder === 0n) return `${whole.toLocaleString()} SUI`;

  // Pad remainder to 9 digits, then strip trailing zeros
  const decimal = remainder.toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole.toLocaleString()}.${decimal} SUI`;
}

/**
 * Format a MIST amount as USD (placeholder 1:1 rate for hackathon).
 *
 * @example
 * formatUsd(50_000_000_000n)  // "$50.00"
 */
export function formatUsd(mist: bigint, suiPriceUsd = 1): string {
  const sui = Number(mist) / 1_000_000_000;
  const usd = sui * suiPriceUsd;
  return `$${usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Truncate a Sui address for display.
 *
 * @example
 * formatAddress("0xe50e03c195bcef64ee2cdfe3cea37f4dba6a65a05e8b3d529ff093a446558b56")
 * // "0xe50e...8b56"
 */
export function formatAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 4) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format a timestamp as a relative time string.
 *
 * @example
 * formatRelativeTime(Date.now() - 3600000)  // "1 hour ago"
 * formatRelativeTime(Date.now() + 86400000) // "in 1 day"
 */
export function formatRelativeTime(timestampMs: number): string {
  const now = Date.now();
  const diff = timestampMs - now;
  const absDiff = Math.abs(diff);
  const isFuture = diff > 0;

  if (absDiff < 60_000) return "just now";

  const minutes = Math.floor(absDiff / 60_000);
  const hours = Math.floor(absDiff / 3_600_000);
  const days = Math.floor(absDiff / 86_400_000);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  let label: string;
  if (years > 0) label = `${years} year${years > 1 ? "s" : ""}`;
  else if (months > 0) label = `${months} month${months > 1 ? "s" : ""}`;
  else if (days > 0) label = `${days} day${days > 1 ? "s" : ""}`;
  else if (hours > 0) label = `${hours} hour${hours > 1 ? "s" : ""}`;
  else label = `${minutes} minute${minutes > 1 ? "s" : ""}`;

  return isFuture ? `in ${label}` : `${label} ago`;
}

/**
 * Format a date as a short readable string.
 *
 * @example
 * formatDate(1717539000000)  // "Jun 4, 2026"
 */
export function formatDate(timestampMs: number): string {
  return new Date(timestampMs).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Milestone / progress computation
// ---------------------------------------------------------------------------

export interface MilestoneProgress {
  /** 0-100 percentage toward condition being met. */
  percentage: number;
  /** Milliseconds remaining until condition is met (0 if already met). */
  remainingMs: number;
  /** Estimated date when condition will be met (null if not time-based). */
  estimatedDate: Date | null;
  /** Whether the condition is currently met. */
  isMet: boolean;
  /** Human-readable status label. */
  label: string;
}

/**
 * Compute milestone progress for a single rule.
 *
 * - **Age/time rules**: Linear progress from trust creation → unlock timestamp.
 * - **Periodic rules**: Progress within the current period (last payment → next due).
 * - **Credential rules**: Binary — 0% or 100% (checked off-chain by agent).
 *
 * @param rule - The on-chain rule to evaluate.
 * @param trustCreatedAt - Trust creation timestamp (ms), used as progress start.
 * @param currentTime - Current time in ms (defaults to Date.now()).
 * @param lastDistributionAt - Last distribution timestamp for periodic rules (0 if never).
 */
export function computeMilestoneProgress(
  rule: RuleState,
  trustCreatedAt: number,
  currentTime = Date.now(),
  lastDistributionAt = 0,
): MilestoneProgress {
  const condValue = Number(rule.conditionValue);

  // Age-based or time-based: unlock at a specific timestamp
  if (rule.ruleType === 0 || rule.ruleType === 1) {
    if (condValue === 0) {
      return { percentage: 100, remainingMs: 0, estimatedDate: null, isMet: true, label: "Condition met" };
    }

    const totalDuration = condValue - trustCreatedAt;
    const elapsed = currentTime - trustCreatedAt;

    if (currentTime >= condValue) {
      return { percentage: 100, remainingMs: 0, estimatedDate: new Date(condValue), isMet: true, label: "Condition met" };
    }

    const percentage = totalDuration > 0 ? Math.min(100, Math.floor((elapsed / totalDuration) * 100)) : 0;
    const remainingMs = condValue - currentTime;

    return {
      percentage,
      remainingMs,
      estimatedDate: new Date(condValue),
      isMet: false,
      label: `${formatRelativeTime(condValue)} remaining`,
    };
  }

  // Periodic: progress within the current period
  if (rule.ruleType === 3) {
    if (condValue === 0) {
      return { percentage: 100, remainingMs: 0, estimatedDate: null, isMet: true, label: "No period set" };
    }

    const periodStart = lastDistributionAt > 0 ? lastDistributionAt : trustCreatedAt;
    const nextDue = periodStart + condValue;
    const elapsed = currentTime - periodStart;

    if (currentTime >= nextDue) {
      return { percentage: 100, remainingMs: 0, estimatedDate: new Date(nextDue), isMet: true, label: "Payment due" };
    }

    const percentage = Math.min(100, Math.floor((elapsed / condValue) * 100));
    const remainingMs = nextDue - currentTime;

    return {
      percentage,
      remainingMs,
      estimatedDate: new Date(nextDue),
      isMet: false,
      label: `Next payment ${formatRelativeTime(nextDue)}`,
    };
  }

  // Credential: binary, checked off-chain
  return {
    percentage: 0,
    remainingMs: 0,
    estimatedDate: null,
    isMet: false,
    label: "Pending verification",
  };
}

// ---------------------------------------------------------------------------
// Veto countdown
// ---------------------------------------------------------------------------

export interface VetoCountdown {
  /** Milliseconds remaining in the veto window (0 if expired). */
  remainingMs: number;
  /** Whether the veto window has expired and execution is possible. */
  canExecute: boolean;
  /** Human-readable countdown label. */
  label: string;
}

/**
 * Compute the veto (override) countdown for a pending distribution.
 *
 * @param dist - The on-chain PendingDistribution.
 * @param currentTime - Current time in ms (defaults to Date.now()).
 */
export function computeVetoCountdown(
  dist: PendingDistributionState,
  currentTime = Date.now(),
): VetoCountdown {
  if (dist.isCancelled) {
    return { remainingMs: 0, canExecute: false, label: "Cancelled" };
  }
  if (dist.isExecuted) {
    return { remainingMs: 0, canExecute: false, label: "Executed" };
  }

  const remaining = dist.executableAfter - currentTime;

  if (remaining <= 0) {
    return { remainingMs: 0, canExecute: true, label: "Ready to execute" };
  }

  return {
    remainingMs: remaining,
    canExecute: false,
    label: `Veto window: ${formatRelativeTime(dist.executableAfter)} remaining`,
  };
}

// ---------------------------------------------------------------------------
// Dashboard aggregate stats
// ---------------------------------------------------------------------------

export interface DashboardStats {
  /** Total number of active trusts. */
  activeTrusts: number;
  /** Total balance across all trusts in MIST. */
  totalBalanceMist: bigint;
  /** Total number of beneficiaries across all trusts. */
  totalBeneficiaries: number;
  /** Total number of active rules. */
  totalActiveRules: number;
  /** Number of pending (unexecuted, uncancelled) distributions. */
  pendingDistributions: number;
}

/**
 * Aggregate stats across multiple trusts for the dashboard header.
 */
export function computeDashboardStats(
  trusts: TrustState[],
  distributions: PendingDistributionState[] = [],
): DashboardStats {
  let totalBalanceMist = 0n;
  let totalBeneficiaries = 0;
  let totalActiveRules = 0;
  let activeTrusts = 0;

  for (const trust of trusts) {
    if (trust.status === 0) activeTrusts++;
    totalBalanceMist += trust.balance;
    totalBeneficiaries += trust.beneficiaries.length;
    totalActiveRules += trust.rules.filter((r) => r.isActive).length;
  }

  const pendingDistributions = distributions.filter(
    (d) => !d.isCancelled && !d.isExecuted,
  ).length;

  return {
    activeTrusts,
    totalBalanceMist,
    totalBeneficiaries,
    totalActiveRules,
    pendingDistributions,
  };
}

// ---------------------------------------------------------------------------
// Document manifest
// ---------------------------------------------------------------------------

/**
 * A trust document stored on Walrus with metadata.
 *
 * Since the on-chain Trust only stores blob IDs (no names), the manifest
 * is stored as the first blob when the trust is created. The manifest
 * itself is Seal-encrypted so only authorized parties can read it.
 */
export interface TrustDocumentManifest {
  /** Version for forward compatibility. */
  version: 1;
  /** Ordered list of documents matching the trust's walrus_blob_ids. */
  documents: TrustDocumentEntry[];
}

export interface TrustDocumentEntry {
  /** Walrus blob ID (matches an entry in trust.walrus_blob_ids). */
  blobId: string;
  /** Human-readable document name. */
  name: string;
  /** MIME type if known (e.g. "application/pdf", "text/plain"). */
  mimeType?: string;
  /** Upload timestamp in ms. */
  uploadedAt: number;
  /** Byte size of the original (unencrypted) document. */
  originalSize?: number;
}

/**
 * Create a new manifest for a set of documents.
 */
export function createDocumentManifest(
  entries: Omit<TrustDocumentEntry, "uploadedAt">[],
): TrustDocumentManifest {
  const now = Date.now();
  return {
    version: 1,
    documents: entries.map((e) => ({ ...e, uploadedAt: now })),
  };
}

/**
 * Serialize a manifest to bytes for Seal encryption + Walrus storage.
 */
export function serializeManifest(manifest: TrustDocumentManifest): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(manifest));
}

/**
 * Deserialize a manifest from decrypted bytes.
 */
export function deserializeManifest(data: Uint8Array): TrustDocumentManifest {
  return JSON.parse(new TextDecoder().decode(data)) as TrustDocumentManifest;
}

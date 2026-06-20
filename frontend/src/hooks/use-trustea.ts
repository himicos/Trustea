"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
// useSuiClient() returns the dapp-kit client — cast as needed

// Package ID — keep in sync with lib/config.ts
export const PACKAGE_ID =
  "0xa3e912b4d4be96e1206bd76cdadb512fe151b9dfd6921bd9afc9be1d97a8487a";

// External proxy holds ANTHROPIC + MEMWAL keys (Walrus Sites = no server).
// In dev, point at local Next routes via NEXT_PUBLIC_API_BASE=/api.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://147.45.240.145:9007/api";

// ─── Types (mirrors lib/trust-reader.ts) ───

export interface DMSState {
  enabled: boolean;
  heartbeatPeriodMs: number;
  gracePeriodMs: number;
  lastHeartbeatAt: number;
  activationThreshold: number;
  activators: string[];
  voteCount: number;
  triggeredAt: number;
  vetoPeriodMs: number;
}

export interface TrustState {
  id: string;
  name: string;
  description: string;
  grantor: string;
  balance: bigint;
  beneficiaries: string[];
  rules: RuleState[];
  status: number;
  walrusBlobIds: string[];
  createdAt: number;
  agentAddress: string;
  overridePeriodMs: number;
  isRevocable: boolean;
  successorGrantor: string | null;
  trustProtector: string | null;
  totalDeposited: bigint;
  totalDistributed: bigint;
  dms: DMSState;
}

export interface RuleState {
  ruleType: number;
  beneficiary: string;
  amount: bigint;
  isPercentage: boolean;
  conditionValue: bigint;
  description: string;
  isActive: boolean;
}

// ─── Hooks ───

/**
 * Fetch and parse a Trust object from chain.
 */
export function useTrust(trustId: string | undefined) {
  const suiClient = useSuiClient();

  return useQuery({
    queryKey: ["trust", trustId],
    enabled: !!trustId,
    queryFn: async () => {
      const response = await (suiClient as any).getObject({
        id: trustId!,
        options: { showContent: true },
      });

      if (!response.data?.content || response.data.content.dataType !== "moveObject") {
        throw new Error("Trust object not found");
      }

      const fields = response.data.content.fields as Record<string, unknown>;
      return parseTrustFields(fields);
    },
    refetchInterval: 10_000, // refresh every 10s
  });
}

/**
 * Fetch trusts created by the connected wallet (grantor sidebar).
 */
export function useMyTrusts() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();

  return useQuery({
    queryKey: ["my-trusts", account?.address],
    enabled: !!account?.address,
    queryFn: async () => {
      const events = await (suiClient as any).queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::trust::TrustCreated`,
        },
        order: "descending",
        limit: 50,
      });

      return (events.data as Array<{ parsedJson: unknown }>)
        .filter((e: { parsedJson: unknown }) => {
          const fields = e.parsedJson as Record<string, unknown>;
          return String(fields?.grantor) === account!.address;
        })
        .map((e: { parsedJson: unknown }) => {
          const fields = e.parsedJson as Record<string, unknown>;
          return {
            trustId: String(fields.trust_id),
            name: String(fields.name),
            createdAt: Number(fields.created_at),
          };
        });
    },
  });
}

/**
 * Fetch BeneficiaryNFTs owned by the connected wallet.
 */
export function useMyBeneficiaryNFTs() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();

  return useQuery({
    queryKey: ["my-nfts", account?.address],
    enabled: !!account?.address,
    queryFn: async () => {
      const response = await (suiClient as any).getOwnedObjects({
        owner: account!.address,
        filter: {
          StructType: `${PACKAGE_ID}::beneficiary_nft::BeneficiaryNFT`,
        },
        options: { showContent: true },
      });

      return (response.data as Array<{ data: any }>)
        .filter((item: { data: any }) => item.data?.content?.dataType === "moveObject")
        .map((item: { data: any }) => ({
          objectId: item.data!.objectId as string,
          fields: item.data!.content!.fields as Record<string, unknown>,
        }));
    },
  });
}

/**
 * Full parsed state for every trust the connected wallet created.
 * Powers the dashboard hero metrics (TVL, distributed, next unlock).
 */
export function useMyTrustsDetails() {
  const { data: myTrusts } = useMyTrusts();
  const suiClient = useSuiClient();
  const ids = (myTrusts ?? []).map((t) => t.trustId);

  return useQuery({
    queryKey: ["my-trusts-details", ids.join(",")],
    enabled: ids.length > 0,
    refetchInterval: 15_000,
    queryFn: async (): Promise<TrustState[]> => {
      const response = await (suiClient as any).multiGetObjects({
        ids,
        options: { showContent: true },
      });
      return (response as Array<any>)
        .filter((r) => r.data?.content?.dataType === "moveObject")
        .map((r) => parseTrustFields(r.data.content.fields as Record<string, unknown>));
    },
  });
}

/** Next future unlock (time/age rule) across a set of trusts, or null. */
export function nextUnlockMs(trusts: TrustState[], now: number): number | null {
  let min: number | null = null;
  for (const t of trusts) {
    for (const r of t.rules) {
      if (!r.isActive) continue;
      if (r.ruleType !== 0 && r.ruleType !== 1) continue;
      const ts = Number(r.conditionValue);
      if (ts > now && (min === null || ts < min)) min = ts;
    }
  }
  return min;
}

/**
 * Live feed of all Trustea contract events (newest first).
 */
export interface TrustEvent {
  type: string;
  /** Event name without the package/module prefix, e.g. "TrustCreated". */
  name: string;
  timestampMs: number;
  txDigest: string;
  fields: Record<string, unknown>;
}

export function useTrustEvents(limit = 30) {
  const suiClient = useSuiClient();

  return useQuery({
    queryKey: ["trust-events", limit],
    refetchInterval: 15_000,
    queryFn: async (): Promise<TrustEvent[]> => {
      const events = await (suiClient as any).queryEvents({
        query: { MoveModule: { package: PACKAGE_ID, module: "trust" } },
        order: "descending",
        limit,
      });
      return (events.data as Array<any>).map((e) => ({
        type: String(e.type),
        name: String(e.type).split("::").pop() ?? "Event",
        timestampMs: Number(e.timestampMs ?? 0),
        txDigest: String(e.id?.txDigest ?? ""),
        fields: (e.parsedJson ?? {}) as Record<string, unknown>,
      }));
    },
  });
}

/**
 * Recall agent memories from MemWal via the API route.
 */
export interface MemoryRecall {
  demo: boolean;
  memories: Array<{ namespace: string; text: string; distance: number }>;
}

export function useAgentMemories(query: string, trustIds: string[]) {
  // Sort for stable cache key
  const sortedIds = [...trustIds].sort();
  return useQuery({
    queryKey: ["agent-memories", query, sortedIds.join(",")],
    queryFn: async (): Promise<MemoryRecall> => {
      const res = await fetch(`${API_BASE}/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, trustIds: sortedIds }),
      });
      if (!res.ok) return { demo: true, memories: [] };
      return res.json();
    },
    staleTime: 30_000,
    // No trust IDs → don't even fetch (avoids leaking data to disconnected viewers)
    enabled: sortedIds.length > 0,
  });
}

/**
 * Translate a plain English rule via the API route.
 */
export function useTranslateRule() {
  return useMutation({
    mutationFn: async (rule: string) => {
      const res = await fetch(`${API_BASE}/translate-rule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

/**
 * Execute a Sui transaction and invalidate relevant queries.
 */
export function useTrusteaTransaction() {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const queryClient = useQueryClient();

  const execute = async (...args: Parameters<typeof signAndExecute>) => {
    const result = await signAndExecute(...args);
    queryClient.invalidateQueries({ queryKey: ["trust"] });
    queryClient.invalidateQueries({ queryKey: ["my-trusts"] });
    queryClient.invalidateQueries({ queryKey: ["my-nfts"] });
    return result;
  };

  return { execute };
}

// ─── DMS Helpers ───

/** Status label for the trust. */
export function trustStatusLabel(status: number): string {
  switch (status) {
    case 0: return "Active";
    case 1: return "Paused";
    case 2: return "Closed";
    case 3: return "DMS Triggered";
    default: return "Unknown";
  }
}

/** Dot class for trust status. */
export function trustStatusDot(status: number): string {
  switch (status) {
    case 0: return "dot-active";
    case 1: return "dot-pending";
    case 2: return "dot-inactive";
    case 3: return "dot-error";
    default: return "dot-inactive";
  }
}

/** Compute DMS phase from trust state + current time. */
export type DMSPhase = "disabled" | "green" | "yellow" | "orange" | "red" | "triggered" | "executed";

export function getDMSPhase(dms: DMSState, status: number, now: number): DMSPhase {
  if (!dms.enabled) return "disabled";
  if (status === 3) return "executed";
  if (dms.triggeredAt > 0) return "triggered";

  const deadline = dms.lastHeartbeatAt + dms.heartbeatPeriodMs;
  const graceEnd = deadline + dms.gracePeriodMs;
  const warningStart = deadline - (7 * 24 * 60 * 60 * 1000); // 7 days before

  if (now >= graceEnd) return "red";
  if (now >= deadline) return "orange";
  if (now >= warningStart) return "yellow";
  return "green";
}

/** Format milliseconds as a human-readable countdown. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ─── Field parsers ───

function parseTrustFields(fields: Record<string, unknown>): TrustState {
  const parseBalance = (raw: unknown): bigint => {
    if (raw == null) return 0n;
    if (typeof raw === "string" || typeof raw === "number") return BigInt(raw);
    if (typeof raw === "object" && raw !== null) {
      if ("fields" in raw) {
        const inner = (raw as { fields: { value: unknown } }).fields;
        return BigInt(String(inner?.value ?? 0));
      }
      if ("value" in raw) return BigInt(String((raw as { value: unknown }).value ?? 0));
    }
    return 0n;
  };

  const parseOption = (raw: unknown): string | null => {
    if (raw == null) return null;
    if (typeof raw === "object" && raw !== null) {
      const vec =
        "fields" in raw
          ? (raw as { fields: { vec: string[] } }).fields?.vec
          : (raw as { vec: string[] }).vec;
      if (Array.isArray(vec) && vec.length > 0) return vec[0];
    }
    return null;
  };

  return {
    id: String((fields.id as { id: string })?.id ?? ""),
    name: String(fields.name ?? ""),
    description: String(fields.description ?? ""),
    grantor: String(fields.grantor ?? ""),
    balance: parseBalance(fields.balance),
    beneficiaries: Array.isArray(fields.beneficiaries) ? fields.beneficiaries : [],
    rules: Array.isArray(fields.rules)
      ? fields.rules.map((r: any) => {
          const f: any = (r?.fields) ? r.fields : r;
          return {
            ruleType: Number(f.rule_type ?? 0),
            beneficiary: String(f.beneficiary ?? ""),
            amount: BigInt(String(f.amount ?? 0)),
            isPercentage: Boolean(f.is_percentage),
            conditionValue: BigInt(String(f.condition_value ?? 0)),
            description: String(f.description ?? ""),
            isActive: Boolean(f.is_active),
          } as RuleState;
        })
      : [],
    status: Number(fields.status ?? 0),
    walrusBlobIds: Array.isArray(fields.walrus_blob_ids) ? fields.walrus_blob_ids : [],
    createdAt: Number(fields.created_at ?? 0),
    agentAddress: String(fields.agent_address ?? ""),
    overridePeriodMs: Number(fields.override_period_ms ?? 0),
    isRevocable: Boolean(fields.is_revocable),
    successorGrantor: parseOption(fields.successor_grantor),
    trustProtector: parseOption(fields.trust_protector),
    totalDeposited: BigInt(String(fields.total_deposited ?? 0)),
    totalDistributed: BigInt(String(fields.total_distributed ?? 0)),
    dms: {
      enabled: Boolean(fields.dms_enabled),
      heartbeatPeriodMs: Number(fields.dms_heartbeat_period_ms ?? 0),
      gracePeriodMs: Number(fields.dms_grace_period_ms ?? 0),
      lastHeartbeatAt: Number(fields.dms_last_heartbeat_at ?? 0),
      activationThreshold: Number(fields.dms_activation_threshold ?? 0),
      activators: Array.isArray(fields.dms_activators) ? fields.dms_activators : [],
      voteCount: parseDMSVoteCount(fields.dms_votes),
      triggeredAt: Number(fields.dms_triggered_at ?? 0),
      vetoPeriodMs: Number(fields.dms_veto_period_ms ?? 0),
    },
  };
}

function parseDMSVoteCount(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === "object" && raw !== null) {
    // VecMap is serialized as { fields: { contents: [...] } }
    const fields = "fields" in raw ? (raw as any).fields : raw;
    const contents = fields?.contents;
    if (Array.isArray(contents)) return contents.length;
  }
  return 0;
}

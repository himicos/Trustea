"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
// useSuiClient() returns the dapp-kit client — cast as needed

// Package ID — keep in sync with lib/config.ts
const PACKAGE_ID =
  "0xe2fb4534f87cb3e8d9d9d80b738ca3dd505100821e1481178af9801019365804";

// ─── Types (mirrors lib/trust-reader.ts) ───

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
 * Translate a plain English rule via the API route.
 */
export function useTranslateRule() {
  return useMutation({
    mutationFn: async (rule: string) => {
      const res = await fetch("/api/translate-rule", {
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
  };
}

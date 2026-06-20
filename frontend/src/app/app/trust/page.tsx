"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  useTrust,
  useTrusteaTransaction,
  useTranslateRule,
  useAgentMemories,
  trustStatusLabel,
  trustStatusDot,
  getDMSPhase,
  formatCountdown,
  PACKAGE_ID,
  type DMSPhase,
} from "@/hooks/use-trustea";
import {
  useCurrentAccount,
  useSuiClient,
  useSignPersonalMessage,
} from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import {
  Vault,
  HeartPulse,
  Users,
  FileText,
  BookLock,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Vote,
  Copy,
  HandCoins,
  Plus,
  Sparkles,
  Loader2,
  LockKeyholeOpen,
  BrainCircuit,
} from "lucide-react";

function Addr({ addr }: { addr: string }) {
  return (
    <span
      className="addr cursor-pointer"
      onClick={() => navigator.clipboard.writeText(addr)}
      title="Click to copy"
    >
      <span className="w-2 h-2 rounded-full bg-green-light shrink-0" />
      {addr.slice(0, 8)}...{addr.slice(-6)}
      <Copy size={10} className="opacity-40" />
    </span>
  );
}

function TrustDetailPageInner() {
  const searchParams = useSearchParams();
  const trustId = searchParams.get("id") ?? "";
  const { data: trust, isLoading } = useTrust(trustId);
  const account = useCurrentAccount();
  const { execute } = useTrusteaTransaction();
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<
    "overview" | "rules" | "dms" | "documents"
  >("overview");

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-28 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (!trust) {
    return (
      <div className="empty-state h-[60vh]">
        <Vault size={36} />
        <h2 className="text-lg font-semibold text-text-primary mt-2">Trust Not Found</h2>
        <p className="text-sm text-text-muted font-mono mt-1">{trustId}</p>
      </div>
    );
  }

  const isGrantor = account?.address === trust.grantor;
  const isProtector = account?.address === trust.trustProtector;
  const isActivator = trust.dms.activators.includes(account?.address ?? "");
  const dmsPhase = getDMSPhase(trust.dms, trust.status, now);
  const heartbeatDeadline =
    trust.dms.lastHeartbeatAt + trust.dms.heartbeatPeriodMs;
  const timeUntilDeadline = heartbeatDeadline - now;

  async function handleHeartbeat() {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::trust::dms_heartbeat`,
      arguments: [tx.object(trustId), tx.object("0x6")],
    });
    await execute({ transaction: tx });
  }

  async function handleVoteTrigger() {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::trust::dms_vote_trigger`,
      arguments: [tx.object(trustId), tx.object("0x6")],
    });
    await execute({ transaction: tx });
  }

  async function handleDMSExecute() {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::trust::dms_execute`,
      arguments: [tx.object(trustId), tx.object("0x6")],
    });
    await execute({ transaction: tx });
  }

  async function handleVeto() {
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::trust::dms_veto`,
      arguments: [tx.object(trustId), tx.object("0x6")],
    });
    await execute({ transaction: tx });
  }

  return (
    <div>
      {/* Hero Card Header */}
      <div className="hero-card mb-6">
        <div className="hero-card-bg">
          <div className="orb" />
          <div className="orb" />
          <div className="orb" />
        </div>
        <div className="hero-card-content">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-semibold">{trust.name}</h1>
              <span
                className={`badge ${
                  trust.status === 0
                    ? "badge-green"
                    : trust.status === 1
                      ? "badge-yellow"
                      : trust.status === 3
                        ? "badge-red"
                        : "badge-gray"
                } !bg-white/15 !text-white`}
              >
                <span className={`dot ${trustStatusDot(trust.status)} dot-pulse`} />
                {trustStatusLabel(trust.status)}
              </span>
            </div>
            <p className="text-sm opacity-80">{trust.description}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold">
              {(Number(trust.balance) / 1e9).toFixed(2)}
            </p>
            <p className="text-xs opacity-60">SUI Balance</p>
          </div>
        </div>
        <div className="hero-card-strip">
          <div>
            <span className="strip-value">{trust.beneficiaries.length}</span>
            <span className="strip-label">Beneficiaries</span>
          </div>
          <div>
            <span className="strip-value">{trust.rules.length}</span>
            <span className="strip-label">Rules</span>
          </div>
          <div>
            <span className="strip-value">{(Number(trust.totalDistributed) / 1e9).toFixed(1)}</span>
            <span className="strip-label">Distributed</span>
          </div>
          <div>
            <span className="strip-value">{trust.walrusBlobIds.length}</span>
            <span className="strip-label">Documents</span>
          </div>
        </div>
      </div>

      {/* Pill tabs */}
      <div className="tab-bar mb-6">
        {(["overview", "rules", "dms", "documents"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`tab ${activeTab === tab ? "tab-active" : ""}`}
          >
            {tab === "dms" ? "DMS" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab trust={trust} trustId={trustId} isGrantor={isGrantor} />
      )}
      {activeTab === "rules" && (
        <RulesTab trust={trust} trustId={trustId} isGrantor={isGrantor} />
      )}
      {activeTab === "dms" && (
        <DMSTab
          trust={trust}
          dmsPhase={dmsPhase}
          now={now}
          timeUntilDeadline={timeUntilDeadline}
          isGrantor={isGrantor}
          isProtector={isProtector}
          isActivator={isActivator}
          onHeartbeat={handleHeartbeat}
          onVote={handleVoteTrigger}
          onExecute={handleDMSExecute}
          onVeto={handleVeto}
        />
      )}
      {activeTab === "documents" && (
        <DocumentsTab trust={trust} trustId={trustId} isGrantor={isGrantor} />
      )}
    </div>
  );
}

// ─── Sub-components ───

function OverviewTab({
  trust,
  trustId,
  isGrantor,
}: {
  trust: NonNullable<ReturnType<typeof useTrust>["data"]>;
  trustId: string;
  isGrantor: boolean;
}) {
  return (
    <div className="space-y-4">
      {isGrantor && <DepositCard trustId={trustId} />}
      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Vault size={16} className="text-green-primary" /> Trust Details
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Grantor">
            <Addr addr={trust.grantor} />
          </Field>
          <Field label="Agent">
            <Addr addr={trust.agentAddress} />
          </Field>
          <Field label="Type">
            <span className={`badge ${trust.isRevocable ? "badge-blue" : "badge-yellow"}`}>
              {trust.isRevocable ? "Revocable" : "Irrevocable"}
            </span>
          </Field>
          <Field label="Override Period">
            {formatCountdown(trust.overridePeriodMs)}
          </Field>
          <Field label="Successor">
            {trust.successorGrantor ? (
              <Addr addr={trust.successorGrantor} />
            ) : (
              <span className="text-text-muted">Not set</span>
            )}
          </Field>
          <Field label="Protector">
            {trust.trustProtector ? (
              <Addr addr={trust.trustProtector} />
            ) : (
              <span className="text-text-muted">Not set</span>
            )}
          </Field>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Users size={16} className="text-info" /> Beneficiaries
        </h3>
        {trust.beneficiaries.length > 0 ? (
          <div className="space-y-2">
            {trust.beneficiaries.map((addr) => (
              <div
                key={addr}
                className="card-flat flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-green-surface flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-green-primary">
                    {addr.slice(2, 4).toUpperCase()}
                  </span>
                </div>
                <Addr addr={addr} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-sm text-center py-4">
            No beneficiaries added yet.
          </p>
        )}
        {isGrantor && <AddBeneficiaryForm trustId={trustId} />}
      </div>

      <AgentRecallCard trustId={trustId} trustName={trust.name} />
    </div>
  );
}

/**
 * Visualises the agent's recall-before-decide loop: shows the most relevant
 * MemWal memories the AI trustee would pull in if it ran its next cycle now.
 * This is what makes the agent better the longer the trust runs — every prior
 * decision becomes context for the next one.
 */
function AgentRecallCard({ trustId, trustName }: { trustId: string; trustName: string }) {
  const query = `${trustName} distribution decisions`;
  const { data, isFetching } = useAgentMemories(query, [trustId]);

  const [demo, setDemo] = useState(false);
  useEffect(() => {
    import("@/lib/demo-mode").then((m) => setDemo(m.isDemoMode()));
  }, []);

  const realMemories = data?.memories ?? [];
  const hasRealMemories = !data?.demo && realMemories.length > 0;

  // Demo polish: when there are no real recalls yet (brand-new trust) and
  // ?demo=1 is on, show rich seed memories so the recall loop is visible.
  const [demoSeed, setDemoSeed] = useState<typeof realMemories>([]);
  useEffect(() => {
    if (!demo || hasRealMemories) return;
    import("@/lib/demo-mode").then((m) =>
      setDemoSeed(m.DEMO_RECALL_MEMORIES.slice(0, 3) as unknown as typeof realMemories),
    );
  }, [demo, hasRealMemories]);

  const memories = hasRealMemories ? realMemories : demoSeed;
  const hasMemories = memories.length > 0;

  return (
    <div className="card-glow">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-green-surface flex items-center justify-center shrink-0">
          <BrainCircuit size={17} className="text-green-light" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            Agent&apos;s working memory
            {isFetching && <Loader2 size={12} className="animate-spin text-green-light" />}
          </h3>
          <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
            What the AI trustee would recall before its next cycle. Persistent on
            Walrus via MemWal — every decision teaches the next one.
          </p>
        </div>
      </div>

      {hasMemories ? (
        <div className="space-y-2">
          {memories.slice(0, 3).map((m, i) => (
            <div key={i} className="card-flat !p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="badge badge-green !text-[10px] !py-0.5">
                  {m.namespace.replace("trustea-", "").replace("trustea:", "")}
                </span>
                <span className="text-[10px] text-text-muted font-mono">
                  dist: {m.distance.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{m.text}</p>
            </div>
          ))}
          <p className="text-[11px] text-text-muted leading-relaxed pt-1">
            Next cycle, the agent recalls these to decide whether to propose,
            wait, or escalate. The pattern compounds — by year five the agent
            knows this trust&apos;s history better than any human trustee could.
          </p>
        </div>
      ) : (
        <div className="card-flat text-center py-5">
          <p className="text-xs text-text-secondary leading-relaxed">
            No memories yet for this trust.{" "}
            <span className="text-text-muted">
              The agent will start recording decisions on its first cycle —
              encrypted on Walrus, scoped to this trust only.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

const SUI_TYPE = "0x2::sui::SUI";

interface WalletCoin {
  coinType: string;
  symbol: string;
  decimals: number;
  totalBalance: bigint;
}

function DepositCard({ trustId }: { trustId: string }) {
  const { execute } = useTrusteaTransaction();
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const [amount, setAmount] = useState("");
  const [coinType, setCoinType] = useState(SUI_TYPE);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: coins } = useQuery({
    queryKey: ["wallet-coins", account?.address],
    enabled: !!account?.address,
    queryFn: async (): Promise<WalletCoin[]> => {
      const balances = await (suiClient as any).getAllBalances({
        owner: account!.address,
      });
      const enriched = await Promise.all(
        (balances as Array<{ coinType: string; totalBalance: string }>).map(
          async (b) => {
            const meta = await (suiClient as any)
              .getCoinMetadata({ coinType: b.coinType })
              .catch(() => null);
            return {
              coinType: b.coinType,
              symbol:
                meta?.symbol ?? b.coinType.split("::").pop() ?? "COIN",
              decimals: meta?.decimals ?? 9,
              totalBalance: BigInt(b.totalBalance),
            };
          },
        ),
      );
      return enriched.filter((c) => c.totalBalance > 0n);
    },
  });

  const selected = coins?.find((c) => c.coinType === coinType) ?? {
    coinType: SUI_TYPE,
    symbol: "SUI",
    decimals: 9,
    totalBalance: 0n,
  };

  async function handleDeposit() {
    const baseUnits = BigInt(
      Math.round(Number(amount) * 10 ** selected.decimals),
    );
    if (baseUnits <= 0n) return;
    setBusy(true);
    setErr(null);
    try {
      const tx = new Transaction();
      if (coinType === SUI_TYPE) {
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(baseUnits)]);
        tx.moveCall({
          target: `${PACKAGE_ID}::trust::deposit`,
          arguments: [tx.object(trustId), coin],
        });
      } else {
        const owned = await (suiClient as any).getCoins({
          owner: account!.address,
          coinType,
          limit: 50,
        });
        const ids = (owned.data as Array<{ coinObjectId: string }>).map(
          (c) => c.coinObjectId,
        );
        if (ids.length === 0) throw new Error("No coins of this type in wallet");
        const primary = tx.object(ids[0]);
        if (ids.length > 1) {
          tx.mergeCoins(primary, ids.slice(1).map((id) => tx.object(id)));
        }
        const [coin] = tx.splitCoins(primary, [tx.pure.u64(baseUnits)]);
        tx.moveCall({
          target: `${PACKAGE_ID}::trust::deposit_coin`,
          typeArguments: [coinType],
          arguments: [tx.object(trustId), coin],
        });
      }
      await execute({ transaction: tx });
      setAmount("");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  const walletBalance =
    Number(selected.totalBalance) / 10 ** selected.decimals;

  return (
    <div className="card-glow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <HandCoins size={16} className="text-green-primary" /> Fund Trust
        </h3>
        <span className="text-xs text-text-muted font-mono">
          {walletBalance.toFixed(2)} {selected.symbol} available
        </span>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          value={amount}
          min={0}
          step="0.1"
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="flex-1"
        />
        <select
          value={coinType}
          onChange={(e) => setCoinType(e.target.value)}
          className="!w-auto shrink-0 font-semibold text-sm"
        >
          {(coins && coins.length > 0
            ? coins
            : [{ coinType: SUI_TYPE, symbol: "SUI" }]
          ).map((c) => (
            <option key={c.coinType} value={c.coinType}>
              {c.symbol}
            </option>
          ))}
        </select>
        <button
          onClick={handleDeposit}
          disabled={busy || !Number(amount)}
          className="btn btn-primary shrink-0"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <HandCoins size={15} />}
          Deposit
        </button>
      </div>
      {err && <p className="text-xs text-error break-all mt-2">{err}</p>}
      <p className="text-xs text-text-muted mt-2">
        Any coin type — non-SUI assets are held in the trust&apos;s multi-asset
        vault on-chain.
      </p>
    </div>
  );
}

function AddBeneficiaryForm({ trustId }: { trustId: string }) {
  const { execute } = useTrusteaTransaction();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleAdd() {
    if (!address.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::trust::add_beneficiary`,
        arguments: [
          tx.object(trustId),
          tx.pure.address(address.trim()),
          tx.pure.string(name || "Beneficiary"),
          tx.pure.string(conditions || ""),
          tx.pure.u64(0),
          tx.pure.bool(false),
          tx.object("0x6"),
        ],
      });
      await execute({ transaction: tx });
      setAddress("");
      setName("");
      setConditions("");
      setOpen(false);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-secondary btn-sm mt-4">
        <Plus size={14} /> Add Beneficiary
      </button>
    );
  }

  return (
    <div className="card-flat mt-4 space-y-3 animate-fade-up">
      <div className="grid grid-cols-2 gap-3">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x..."
          className="font-mono text-sm"
        />
      </div>
      <input
        type="text"
        value={conditions}
        onChange={(e) => setConditions(e.target.value)}
        placeholder="Conditions summary (e.g. monthly stipend while enrolled)"
      />
      {err && <p className="text-xs text-error break-all">{err}</p>}
      <div className="flex gap-2">
        <button onClick={handleAdd} disabled={busy || !address.trim()} className="btn btn-primary btn-sm">
          {busy && <Loader2 size={13} className="animate-spin" />} Add On-Chain
        </button>
        <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">Cancel</button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-text-muted text-xs mb-1">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function RulesTab({
  trust,
  trustId,
  isGrantor,
}: {
  trust: NonNullable<ReturnType<typeof useTrust>["data"]>;
  trustId: string;
  isGrantor: boolean;
}) {
  const ruleTypeLabel = (t: number) => {
    switch (t) {
      case 0: return "Age";
      case 1: return "Time";
      case 2: return "Credential";
      case 3: return "Periodic";
      default: return "Unknown";
    }
  };
  const ruleTypeBadge = (t: number) => {
    switch (t) {
      case 0: return "badge-yellow";
      case 1: return "badge-blue";
      case 2: return "badge-green";
      case 3: return "badge-gray";
      default: return "badge-gray";
    }
  };

  return (
    <div className="space-y-3">
      {trust.rules.length === 0 ? (
        <div className="card empty-state">
          <FileText size={28} />
          <p className="text-text-muted">No rules configured yet.</p>
        </div>
      ) : (
        trust.rules.map((rule, i) => (
          <div key={i} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`badge ${rule.isActive ? "badge-green" : "badge-gray"}`}>
                    {rule.isActive ? "Active" : "Inactive"}
                  </span>
                  <span className={`badge ${ruleTypeBadge(rule.ruleType)}`}>
                    {ruleTypeLabel(rule.ruleType)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{rule.description}</p>
                <div className="mt-2">
                  <Addr addr={rule.beneficiary} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-semibold">
                  {rule.isPercentage
                    ? `${Number(rule.amount) / 100}%`
                    : `${(Number(rule.amount) / 1e9).toFixed(2)} SUI`}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
      {isGrantor && <AddRuleForm trust={trust} trustId={trustId} />}
    </div>
  );
}

const RULE_TYPE_NUM: Record<string, number> = {
  age: 0,
  time: 1,
  credential: 2,
  periodic: 3,
  recurring: 3,
  recurringpayment: 3,
  monthly: 3,
  schedule: 3,
  date: 1,
  milestone: 2,
  compound: 2,
  custom: 2,
};

function ruleTypeNum(ruleType: string): number {
  const key = ruleType.toLowerCase().replace(/[^a-z]/g, "");
  if (key in RULE_TYPE_NUM) return RULE_TYPE_NUM[key];
  for (const [k, v] of Object.entries(RULE_TYPE_NUM)) {
    if (key.includes(k)) return v;
  }
  return 2;
}

function AddRuleForm({
  trust,
  trustId,
}: {
  trust: NonNullable<ReturnType<typeof useTrust>["data"]>;
  trustId: string;
}) {
  const { execute } = useTrusteaTransaction();
  const translateRule = useTranslateRule();
  const [text, setText] = useState("");
  const [beneficiary, setBeneficiary] = useState(trust.beneficiaries[0] ?? "");
  const [translation, setTranslation] = useState<{
    rule: {
      ruleType: string;
      amount: number;
      isPercentage: boolean;
      conditionDescription: string;
      conditionParams?: { timestamp?: number; periodMs?: number };
    };
    explanation: string;
    confidence: number;
    warnings: string[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (trust.beneficiaries.length === 0) {
    return (
      <p className="text-xs text-text-muted text-center">
        Add a beneficiary first — rules are bound to beneficiaries.
      </p>
    );
  }

  async function handleTranslate() {
    if (!text.trim()) return;
    setErr(null);
    try {
      const result = await translateRule.mutateAsync(text);
      setTranslation(result);
    } catch (e) {
      setErr(String(e));
    }
  }

  async function handleAdd() {
    if (!translation || !beneficiary) return;
    setBusy(true);
    setErr(null);
    try {
      const t = translation.rule;
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::trust::add_rule`,
        arguments: [
          tx.object(trustId),
          tx.pure.u8(ruleTypeNum(t.ruleType)),
          tx.pure.address(beneficiary),
          tx.pure.u64(
            t.isPercentage ? Math.round(t.amount * 100) : Math.round(t.amount * 1e9),
          ),
          tx.pure.bool(t.isPercentage),
          tx.pure.u64(Math.round(t.conditionParams?.timestamp ?? t.conditionParams?.periodMs ?? 0)),
          tx.pure.string(t.conditionDescription || text),
        ],
      });
      await execute({ transaction: tx });
      setText("");
      setTranslation(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-glow space-y-3">
      <h3 className="font-semibold flex items-center gap-2 text-sm">
        <Sparkles size={15} className="text-green-primary" /> New Rule — plain English
      </h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleTranslate()}
          placeholder='"Release 100 SUI when she turns 25"'
        />
        <button
          onClick={handleTranslate}
          disabled={translateRule.isPending || !text.trim()}
          className="btn btn-primary !min-h-0 !px-4 shrink-0"
        >
          {translateRule.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
        </button>
      </div>
      {translation && (
        <div className="card-flat space-y-2 animate-fade-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="badge badge-green capitalize">{translation.rule.ruleType}</span>
              <span className="font-semibold text-sm">
                {translation.rule.isPercentage
                  ? `${translation.rule.amount}%`
                  : `${translation.rule.amount} SUI`}
              </span>
            </div>
            <span className="text-xs text-text-muted font-mono">
              {Math.round(translation.confidence * 100)}% confident
            </span>
          </div>
          <p className="text-sm text-text-secondary">{translation.explanation}</p>
          {translation.warnings.map((w, i) => (
            <p key={i} className="text-xs text-warning flex items-center gap-1.5">
              <AlertTriangle size={11} className="shrink-0" /> {w}
            </p>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-text-muted">For:</span>
            <select
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
              className="!w-auto !py-1.5 !px-3 text-sm font-mono"
            >
              {trust.beneficiaries.map((addr) => (
                <option key={addr} value={addr}>
                  {addr.slice(0, 10)}...{addr.slice(-4)}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={busy || translation.rule.amount <= 0}
              className="btn btn-primary btn-sm ml-auto"
            >
              {busy && <Loader2 size={13} className="animate-spin" />} Add On-Chain
            </button>
          </div>
          {translation.rule.amount <= 0 && (
            <p className="text-xs text-warning">Rule needs a non-zero amount to deploy.</p>
          )}
        </div>
      )}
      {err && <p className="text-xs text-error break-all">{err}</p>}
    </div>
  );
}

const PHASE_CONFIG: Record<
  DMSPhase,
  { bg: string; text: string; label: string; icon: typeof CheckCircle }
> = {
  disabled: { bg: "bg-background", text: "text-text-muted", label: "Disabled", icon: Clock },
  green: { bg: "bg-green-surface", text: "text-green-primary", label: "Healthy", icon: CheckCircle },
  yellow: { bg: "bg-warning-surface", text: "text-warning", label: "Reminder Due", icon: AlertTriangle },
  orange: { bg: "bg-warning-surface", text: "text-warning", label: "Grace Period", icon: AlertTriangle },
  red: { bg: "bg-error-surface", text: "text-error", label: "Votes Open", icon: AlertTriangle },
  triggered: { bg: "bg-error-surface", text: "text-error", label: "Triggered", icon: XCircle },
  executed: { bg: "bg-error-surface", text: "text-error", label: "Successor Controls", icon: XCircle },
};

function DMSTab({
  trust,
  dmsPhase,
  now,
  timeUntilDeadline,
  isGrantor,
  isProtector,
  isActivator,
  onHeartbeat,
  onVote,
  onExecute,
  onVeto,
}: {
  trust: NonNullable<ReturnType<typeof useTrust>["data"]>;
  dmsPhase: DMSPhase;
  now: number;
  timeUntilDeadline: number;
  isGrantor: boolean;
  isProtector: boolean;
  isActivator: boolean;
  onHeartbeat: () => Promise<void>;
  onVote: () => Promise<void>;
  onExecute: () => Promise<void>;
  onVeto: () => Promise<void>;
}) {
  const { dms } = trust;

  if (!dms.enabled) {
    return (
      <div className="card empty-state py-16">
        <Clock size={36} />
        <h3 className="text-lg font-semibold text-text-primary mt-2">Not Enabled</h3>
        <p className="text-sm text-text-muted mt-1 max-w-xs">
          Dead Man's Switch can be configured by the grantor to enable automatic succession.
        </p>
      </div>
    );
  }

  const phase = PHASE_CONFIG[dmsPhase];
  const PhaseIcon = phase.icon;
  const deadline = dms.lastHeartbeatAt + dms.heartbeatPeriodMs;
  const graceEnd = deadline + dms.gracePeriodMs;
  const vetoEnd =
    dms.triggeredAt > 0 ? dms.triggeredAt + dms.vetoPeriodMs : 0;

  const elapsed = now - dms.lastHeartbeatAt;
  const totalPeriod = dms.heartbeatPeriodMs + dms.gracePeriodMs;
  const progressPct = Math.min(100, (elapsed / totalPeriod) * 100);

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={`card ${phase.bg} border-transparent`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <PhaseIcon size={22} className={phase.text} />
            <div className="min-w-0">
              <p className={`font-semibold ${phase.text}`}>{phase.label}</p>
              <p className="text-sm text-text-secondary truncate">
                {dmsPhase === "green" &&
                  `Next heartbeat in ${formatCountdown(timeUntilDeadline)}`}
                {dmsPhase === "yellow" &&
                  `Due in ${formatCountdown(timeUntilDeadline)}`}
                {dmsPhase === "orange" &&
                  `Grace ends in ${formatCountdown(graceEnd - now)}`}
                {dmsPhase === "red" &&
                  `${dms.voteCount}/${dms.activationThreshold} votes`}
                {dmsPhase === "triggered" &&
                  `Veto window: ${formatCountdown(vetoEnd - now)}`}
                {dmsPhase === "executed" && "Control transferred to successor"}
              </p>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {isGrantor && dmsPhase !== "executed" && (
              <button onClick={onHeartbeat} className="btn btn-primary btn-sm">
                <HeartPulse size={14} /> I'm Alive
              </button>
            )}
            {isActivator && dmsPhase === "red" && (
              <button onClick={onVote} className="btn btn-secondary btn-sm">
                <Vote size={14} /> Vote
              </button>
            )}
            {isProtector && dmsPhase === "triggered" && (
              <button onClick={onVeto} className="btn btn-danger btn-sm">
                <XCircle size={14} /> Veto
              </button>
            )}
            {dmsPhase === "triggered" && vetoEnd > 0 && now >= vetoEnd && (
              <button onClick={onExecute} className="btn btn-primary btn-sm">
                Execute
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="card">
        <div className="flex justify-between text-xs text-text-muted mb-2">
          <span>
            Last heartbeat:{" "}
            {dms.lastHeartbeatAt > 0
              ? new Date(dms.lastHeartbeatAt).toLocaleDateString()
              : "Never"}
          </span>
          <span>Deadline: {new Date(deadline).toLocaleDateString()}</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${progressPct}%`,
              background:
                progressPct > 80
                  ? "linear-gradient(90deg, #EF4444, #DC2626)"
                  : progressPct > 60
                    ? "linear-gradient(90deg, #F59E0B, #D97706)"
                    : undefined,
            }}
          />
        </div>
      </div>

      {/* Config */}
      <div className="card">
        <h3 className="font-semibold mb-4">Configuration</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="card-flat text-center">
            <p className="text-lg font-semibold">{formatCountdown(dms.heartbeatPeriodMs)}</p>
            <p className="text-xs text-text-muted">Heartbeat</p>
          </div>
          <div className="card-flat text-center">
            <p className="text-lg font-semibold">{formatCountdown(dms.gracePeriodMs)}</p>
            <p className="text-xs text-text-muted">Grace Period</p>
          </div>
          <div className="card-flat text-center">
            <p className="text-lg font-semibold">{formatCountdown(dms.vetoPeriodMs)}</p>
            <p className="text-xs text-text-muted">Veto Window</p>
          </div>
          <div className="card-flat text-center">
            <p className="text-lg font-semibold">
              {dms.activationThreshold}/{dms.activators.length}
            </p>
            <p className="text-xs text-text-muted">Threshold</p>
          </div>
        </div>

        <p className="section-label mt-5 mb-2">Activators</p>
        <div className="flex flex-wrap gap-2">
          {dms.activators.map((addr) => (
            <Addr key={addr} addr={addr} />
          ))}
        </div>
      </div>

      {/* Escalation */}
      <div className="card">
        <h3 className="font-semibold mb-4">Escalation Timeline</h3>
        <div className="flex items-center gap-1">
          {(
            [
              { key: "green", label: "Normal", color: "bg-green-surface text-green-primary" },
              { key: "yellow", label: "Warning", color: "bg-warning-surface text-warning" },
              { key: "orange", label: "Grace", color: "bg-warning-surface text-warning" },
              { key: "red", label: "Votes", color: "bg-error-surface text-error" },
              { key: "triggered", label: "Veto", color: "bg-error-surface text-error" },
              { key: "executed", label: "Done", color: "bg-error-surface text-error" },
            ] as const
          ).map((p) => (
            <div
              key={p.key}
              className={`flex-1 text-center py-2.5 rounded-xl text-xs font-medium transition-all ${
                dmsPhase === p.key
                  ? `${p.color} ring-2 ring-offset-1 ring-green-primary/30`
                  : "bg-background text-text-muted"
              }`}
            >
              {p.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentsTab({
  trust,
  trustId,
  isGrantor,
}: {
  trust: NonNullable<ReturnType<typeof useTrust>["data"]>;
  trustId: string;
  isGrantor: boolean;
}) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { execute } = useTrusteaTransaction();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [uploading, setUploading] = useState(false);
  const [decrypting, setDecrypting] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isBeneficiary = trust.beneficiaries.includes(account?.address ?? "");
  const canDecrypt = isGrantor || isBeneficiary;

  async function handleUpload(file: File) {
    setUploading(true);
    setErr(null);
    try {
      setStatus("Encrypting with Seal…");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { encryptAndStoreDocument } = await import("@/lib/seal-docs");
      setStatus("Storing on Walrus…");
      const { blobId } = await encryptAndStoreDocument({
        suiClient,
        trustId,
        fileName: file.name,
        mimeType: file.type,
        fileBytes: bytes,
      });
      setStatus("Recording reference on-chain…");
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::trust::add_walrus_ref`,
        arguments: [tx.object(trustId), tx.pure.string(blobId)],
      });
      await execute({ transaction: tx });
      setStatus(null);
    } catch (e) {
      setErr(String(e));
      setStatus(null);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDecrypt(blobId: string) {
    setDecrypting(blobId);
    setErr(null);
    try {
      const { createDocumentSessionKey, fetchAndDecryptDocument } = await import(
        "@/lib/seal-docs"
      );
      setStatus("Creating Seal session…");
      const sessionKey = await createDocumentSessionKey(account!.address, suiClient);
      const { signature } = await signPersonalMessage({
        message: sessionKey.getPersonalMessage(),
      });
      await sessionKey.setPersonalMessageSignature(signature);
      setStatus("Fetching from Walrus & decrypting…");
      const doc = await fetchAndDecryptDocument({
        suiClient,
        trustId,
        blobId,
        sessionKey,
      });
      const blob = new Blob([doc.bytes as BlobPart], { type: doc.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(null);
    } catch (e) {
      setErr(String(e));
      setStatus(null);
    } finally {
      setDecrypting(null);
    }
  }

  return (
    <div className="space-y-3">
      {isGrantor && (
        <div className="card-glow">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <BookLock size={15} className="text-green-primary" /> Encrypted Documents
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Seal-encrypted in your browser, stored on Walrus, referenced on-chain.
                Only the grantor and beneficiaries can decrypt.
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn btn-primary btn-sm shrink-0"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Upload
            </button>
          </div>
          {status && <p className="text-xs text-green-light mt-3">{status}</p>}
        </div>
      )}

      {err && (
        <div className="card !border-error/40 !p-3">
          <p className="text-xs text-error break-all">{err}</p>
        </div>
      )}

      {trust.walrusBlobIds.length === 0 ? (
        <div className="card empty-state py-16">
          <BookLock size={36} />
          <h3 className="text-lg font-semibold text-text-primary mt-2">No Documents</h3>
          <p className="text-sm text-text-muted mt-1">
            Encrypted documents stored on Walrus will appear here.
          </p>
        </div>
      ) : (
        trust.walrusBlobIds.map((blobId, i) => (
          <div key={i} className="card flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-info-surface flex items-center justify-center shrink-0">
              <BookLock size={18} className="text-info" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Document {i + 1}</p>
              <p className="text-xs text-text-muted font-mono truncate">{blobId}</p>
            </div>
            {canDecrypt && (
              <button
                onClick={() => handleDecrypt(blobId)}
                disabled={decrypting !== null}
                className="btn btn-secondary btn-sm shrink-0"
              >
                {decrypting === blobId ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <LockKeyholeOpen size={13} />
                )}
                Decrypt
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}


export default function TrustDetailPage() {
  return (
    <Suspense fallback={null}>
      <TrustDetailPageInner />
    </Suspense>
  );
}

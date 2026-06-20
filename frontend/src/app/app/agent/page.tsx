"use client";

import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  Radar,
  Zap,
  HeartPulse,
  FileText,
  Clock,
  Vault,
  Users,
  Fingerprint,
  HandCoins,
  Vote,
  type LucideIcon,
} from "lucide-react";
import {
  useTrustEvents,
  useMyTrusts,
  useMyBeneficiaryNFTs,
  type TrustEvent,
} from "@/hooks/use-trustea";

const EVENT_STYLE: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  TrustCreated: { icon: Vault, color: "bg-green-surface text-green-primary", label: "Trust Created" },
  TrustDeposit: { icon: HandCoins, color: "bg-green-surface text-green-primary", label: "Deposit" },
  CoinDeposited: { icon: HandCoins, color: "bg-green-surface text-green-primary", label: "Coin Deposit" },
  BeneficiaryAdded: { icon: Users, color: "bg-info-surface text-info", label: "Beneficiary Added" },
  BeneficiaryRemoved: { icon: Users, color: "bg-warning-surface text-warning", label: "Beneficiary Removed" },
  RuleAdded: { icon: FileText, color: "bg-info-surface text-info", label: "Rule Added" },
  DistributionProposed: { icon: Zap, color: "bg-warning-surface text-warning", label: "Distribution Proposed" },
  DistributionExecuted: { icon: Zap, color: "bg-green-surface text-green-primary", label: "Distribution Executed" },
  DistributionRequested: { icon: FileText, color: "bg-info-surface text-info", label: "Distribution Requested" },
  DMSHeartbeat: { icon: HeartPulse, color: "bg-error-surface text-error", label: "DMS Heartbeat" },
  DMSVoteCast: { icon: Vote, color: "bg-error-surface text-error", label: "DMS Vote" },
  DMSTriggered: { icon: HeartPulse, color: "bg-error-surface text-error", label: "DMS Triggered" },
  WalrusRefAdded: { icon: FileText, color: "bg-info-surface text-info", label: "Document Stored" },
  BeneficiaryNFTMinted: { icon: Fingerprint, color: "bg-info-surface text-info", label: "Beneficiary NFT Minted" },
  BeneficiaryNFTBurned: { icon: Fingerprint, color: "bg-warning-surface text-warning", label: "Beneficiary NFT Burned" },
  DMSConfigured: { icon: HeartPulse, color: "bg-error-surface text-error", label: "DMS Configured" },
  SuccessorGrantorSet: { icon: Users, color: "bg-info-surface text-info", label: "Successor Set" },
  AgentRotated: { icon: Radar, color: "bg-info-surface text-info", label: "Agent Rotated" },
};

const DEMO_EVENTS = [
  { name: "DistributionProposed", detail: "25 SUI to Alice — drug test credential verified.", time: "preview" },
  { name: "DMSHeartbeat", detail: "Grantor confirmed alive. Timer reset to 90d.", time: "preview" },
  { name: "RuleAdded", detail: "Periodic rule: monthly stipend while enrolled.", time: "preview" },
  { name: "TrustCreated", detail: "Family Trust Alpha — revocable, 2 beneficiaries.", time: "preview" },
];

function timeAgo(ms: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function eventDetail(e: TrustEvent): string {
  const f = e.fields;
  const parts: string[] = [];
  if (typeof f.name === "string" && f.name) parts.push(f.name);
  if (typeof f.beneficiary_name === "string" && f.beneficiary_name) parts.push(f.beneficiary_name);
  if (f.amount != null) parts.push(`${(Number(f.amount) / 1e9).toFixed(2)} SUI`);
  if (typeof f.reason === "string" && f.reason) parts.push(f.reason);
  if (typeof f.trust_id === "string") parts.push(`trust ${String(f.trust_id).slice(0, 8)}…`);
  return parts.join(" · ") || "On-chain event";
}

export default function AgentPage() {
  const account = useCurrentAccount();
  const { data: allEvents, isLoading } = useTrustEvents(50);
  const { data: myTrusts } = useMyTrusts();
  const { data: myNfts } = useMyBeneficiaryNFTs();
  const [scope, setScope] = useState<"mine" | "all">("mine");

  // "My trusts" = trusts I created as grantor + trusts I'm beneficiary of.
  const myTrustIds = new Set<string>();
  for (const t of myTrusts ?? []) myTrustIds.add(t.trustId);
  for (const nft of myNfts ?? []) {
    const tid = String((nft.fields as { trust_id?: unknown }).trust_id ?? "");
    if (tid) myTrustIds.add(tid);
  }
  const canFilter = !!account && myTrustIds.size > 0;
  const events =
    canFilter && scope === "mine"
      ? (allEvents ?? []).filter((e) => myTrustIds.has(String(e.fields.trust_id)))
      : allEvents;
  const isLive = !!events && events.length > 0;

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-green-surface flex items-center justify-center">
          <Radar size={20} className="text-green-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Agent Activity</h1>
          <p className="text-text-muted text-xs">On-chain audit trail of every trust action</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {canFilter && (
            <div className="tab-bar !p-1">
              <button
                onClick={() => setScope("mine")}
                className={`tab !py-1.5 !px-3 ${scope === "mine" ? "tab-active" : ""}`}
              >
                My Trusts
              </button>
              <button
                onClick={() => setScope("all")}
                className={`tab !py-1.5 !px-3 ${scope === "all" ? "tab-active" : ""}`}
              >
                All
              </button>
            </div>
          )}
          {isLive ? (
            <div className="flex items-center gap-2">
              <span className="dot dot-active dot-pulse" />
              <span className="text-xs font-semibold text-green-primary">Live · Testnet</span>
            </div>
          ) : isLoading ? null : (
            <span className="badge badge-gray">Demo preview</span>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="milestone-card mb-6">
        <div className="milestone-card-bg">
          <div className="m-orb" />
          <div className="m-orb" />
        </div>
        <div className="milestone-card-content">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold">{isLive ? events.length : "—"}</p>
              <p className="text-xs opacity-70">Recent Events</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">
                {isLive ? events.filter((e) => e.name.startsWith("Distribution")).length : "—"}
              </p>
              <p className="text-xs opacity-70">Distributions</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">
                {isLive ? events.filter((e) => e.name.startsWith("DMS")).length : "—"}
              </p>
              <p className="text-xs opacity-70">DMS Actions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
      ) : isLive ? (
        <div className="space-y-3">
          {events.map((evt, i) => {
            const style = EVENT_STYLE[evt.name] ?? {
              icon: Zap,
              color: "bg-green-surface text-green-primary",
              label: evt.name.replace(/([A-Z])/g, " $1").trim(),
            };
            const Icon = style.icon;
            return (
              <a
                key={`${evt.txDigest}-${i}`}
                href={`https://testnet.suivision.xyz/txblock/${evt.txDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="card !p-4 flex items-start gap-3 animate-fade-up hover:border-green-light"
                style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
              >
                <div className={`w-9 h-9 rounded-xl ${style.color} flex items-center justify-center shrink-0`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-semibold text-sm">{style.label}</p>
                    <span className="text-xs text-text-muted flex items-center gap-1">
                      <Clock size={10} /> {timeAgo(evt.timestampMs)}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary truncate">{eventDetail(evt)}</p>
                </div>
              </a>
            );
          })}
        </div>
      ) : canFilter && scope === "mine" && (allEvents?.length ?? 0) > 0 ? (
        <div className="card empty-state py-12">
          <Radar size={32} />
          <p className="text-sm text-text-muted mt-2">
            No activity for your trusts yet. Deposit or add a rule to get started.
          </p>
          <button onClick={() => setScope("all")} className="btn btn-ghost btn-sm mt-3">
            View all contract activity
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {DEMO_EVENTS.map((evt, i) => {
            const style = EVENT_STYLE[evt.name]!;
            const Icon = style.icon;
            return (
              <div key={i} className="card !p-4 flex items-start gap-3 opacity-70">
                <div className={`w-9 h-9 rounded-xl ${style.color} flex items-center justify-center shrink-0`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-semibold text-sm">{style.label}</p>
                    <span className="badge badge-gray !py-0.5">{evt.time}</span>
                  </div>
                  <p className="text-sm text-text-secondary">{evt.detail}</p>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-text-muted text-center pt-2">
            Demo preview — create a trust to see your live on-chain activity here.
          </p>
        </div>
      )}

      {isLive && (
        <p className="text-xs text-text-muted text-center mt-6">
          Live events from the Trustea contract on Sui testnet. Click any event to view the transaction.
        </p>
      )}
    </div>
  );
}

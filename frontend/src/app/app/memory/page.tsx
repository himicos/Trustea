"use client";

import { useEffect, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { BrainCircuit, Database, Search, Layers3, Loader2, Lock } from "lucide-react";
import {
  useAgentMemories,
  useMyTrusts,
  useMyBeneficiaryNFTs,
} from "@/hooks/use-trustea";
import { isDemoMode, DEMO_RECALL_MEMORIES } from "@/lib/demo-mode";

const FALLBACK_MEMORIES = [
  { namespace: "trustea-decisions", text: "Cycle at 2026-06-08. Checked 3 conditions: 1 met. Generated 1 proposal for 25 SUI to Alice. Informed by 8 prior memories.", distance: 0.12 },
  { namespace: "trustea-decisions", text: "Distribution proposal: 25 SUI monthly to Alice. Drug test credential verified on-chain. Prior 3 distributions successful.", distance: 0.18 },
  { namespace: "trustea-events", text: "Trust created: Family Trust Alpha. Grantor 0xAAAA. Revocable. 2 beneficiaries. DMS enabled with 90d heartbeat.", distance: 0.42 },
  { namespace: "trustea-decisions", text: "Cycle at 2026-06-07. 3 conditions checked, 0 met. No proposals. Recalled 6 prior memories in 92ms.", distance: 0.45 },
];

const NS_COLORS: Record<string, string> = {
  "trustea-decisions": "badge-green",
  "trustea-events": "badge-blue",
  "trustea-comms": "badge-yellow",
  "trustea:agent-test": "badge-green",
};

export default function MemoryPage() {
  const account = useCurrentAccount();
  const { data: myTrusts } = useMyTrusts();
  const { data: myNfts } = useMyBeneficiaryNFTs();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("trust decisions and distributions");

  const myTrustIds: string[] = [];
  for (const t of myTrusts ?? []) myTrustIds.push(t.trustId);
  for (const nft of myNfts ?? []) {
    const tid = String((nft.fields as { trust_id?: unknown }).trust_id ?? "");
    if (tid) myTrustIds.push(tid);
  }

  const { data, isFetching } = useAgentMemories(query, myTrustIds);

  const [demo, setDemo] = useState(false);
  useEffect(() => {
    setDemo(isDemoMode());
  }, []);

  const isLive = !!data && !data.demo && data.memories.length > 0;
  const noAccess = !account || myTrustIds.length === 0;
  // Seeded memories only when the visitor has no trust to recall from — never
  // leaked onto an authenticated wallet's view, even in demo mode.
  const fallback = noAccess ? (demo ? [...DEMO_RECALL_MEMORIES] : FALLBACK_MEMORIES) : [];
  const memories = isLive ? data.memories : fallback;
  const namespaces = new Set(memories.map((m) => m.namespace));

  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-green-surface flex items-center justify-center">
          <BrainCircuit size={20} className="text-green-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Agent Memory</h1>
          <p className="text-text-muted text-xs">
            What the AI trustee remembers about your trusts — stored on Walrus via MemWal
          </p>
        </div>
        <div className="ml-auto">
          {noAccess ? (
            <span className="badge badge-gray"><Lock size={11} /> Demo preview</span>
          ) : isLive ? (
            <span className="badge badge-green">
              <span className="dot dot-active dot-pulse" /> Live recall · {myTrustIds.length} trust{myTrustIds.length > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="badge badge-gray">No memories yet</span>
          )}
        </div>
      </div>

      {noAccess && (
        <div className="card-flat !bg-warning-surface !border-warning/30 mb-6 flex items-start gap-3">
          <Lock size={16} className="text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-text-secondary">
            {account
              ? "You don't yet have a trust. Memories shown below are a sample of the format — real recall is scoped to trusts you grant or beneficiary."
              : "Connect a wallet to recall memories from your trusts. The agent's full history is encrypted on Walrus; only authorized parties see decisions about a given trust."}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card !p-4 text-center">
          <Database size={18} className="text-green-primary mx-auto mb-2" />
          <p className="text-xl font-semibold">{memories.length}</p>
          <p className="text-xs text-text-muted">Memories Recalled</p>
        </div>
        <div className="card !p-4 text-center">
          <Search size={18} className="text-info mx-auto mb-2" />
          <p className="text-xl font-semibold">
            {memories.length ? memories[0].distance.toFixed(2) : "—"}
          </p>
          <p className="text-xs text-text-muted">Best Match Distance</p>
        </div>
        <div className="card !p-4 text-center">
          <Layers3 size={18} className="text-warning mx-auto mb-2" />
          <p className="text-xl font-semibold">{namespaces.size}</p>
          <p className="text-xs text-text-muted">Namespaces</p>
        </div>
      </div>

      {/* Semantic search */}
      <form
        className="mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (search.trim()) setQuery(search.trim());
        }}
      >
        <div className="relative">
          {isFetching ? (
            <Loader2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-green-primary animate-spin" />
          ) : (
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
          )}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Semantic search agent memories… (press Enter)"
            className="!pl-11"
          />
        </div>
      </form>

      {/* Memories list */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="section-label">
          {isLive ? `Recall: "${query}"` : "Sample memories"}
        </p>
      </div>
      <div className="space-y-3">
        {memories.map((mem, i) => (
          <div
            key={i}
            className={`card !p-4 animate-fade-up ${isLive ? "" : "opacity-70"}`}
            style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`badge ${NS_COLORS[mem.namespace] ?? "badge-gray"}`}>
                {mem.namespace.replace("trustea-", "")}
              </span>
              <span className="text-xs text-text-muted font-mono">
                dist: {mem.distance.toFixed(2)}
              </span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{mem.text}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-muted text-center mt-6">
        {isLive
          ? "Memories stored on Walrus. Semantic recall via MemWal vector search."
          : "Demo preview — run the agent to build real memories on Walrus."}
      </p>
    </div>
  );
}

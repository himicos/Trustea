"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  useTrust,
  useTrusteaTransaction,
  trustStatusLabel,
  PACKAGE_ID,
} from "@/hooks/use-trustea";
import {
  Fingerprint,
  Vault,
  ScrollText,
  Loader2,
  Send,
  Lock,
} from "lucide-react";

interface NFTFields {
  trust_id: string;
  beneficiary: string;
  beneficiary_name: string;
  conditions_summary: string;
  allocation_amount: string;
  is_percentage: boolean;
  minted_at: string;
}

function BeneficiaryPageInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const suiClient = useSuiClient();
  const account = useCurrentAccount();

  const { data: nft, isLoading } = useQuery({
    queryKey: ["beneficiary-nft", id],
    queryFn: async () => {
      const response = await (suiClient as any).getObject({
        id,
        options: { showContent: true },
      });
      if (response.data?.content?.dataType !== "moveObject") {
        throw new Error("NFT not found");
      }
      return response.data.content.fields as NFTFields;
    },
  });

  const { data: trust } = useTrust(nft?.trust_id);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
      </div>
    );
  }

  if (!nft) {
    return (
      <div className="empty-state h-[60vh]">
        <Fingerprint size={36} />
        <h2 className="text-lg font-semibold text-text-primary mt-2">NFT Not Found</h2>
        <p className="text-sm text-text-muted font-mono mt-1">{id}</p>
      </div>
    );
  }

  const isOwner = account?.address === nft.beneficiary;
  const allocation = nft.is_percentage
    ? `${Number(nft.allocation_amount) / 100}% of trust`
    : `${(Number(nft.allocation_amount) / 1e9).toFixed(2)} SUI`;

  return (
    <div>
      {/* Soulbound NFT card */}
      <div className="milestone-card mb-6">
        <div className="milestone-card-bg">
          <div className="m-orb" />
          <div className="m-orb" />
        </div>
        <div className="milestone-card-content">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Fingerprint size={18} />
                <span className="text-xs uppercase tracking-wider opacity-70">
                  Soulbound Beneficiary NFT
                </span>
              </div>
              <h1 className="text-2xl font-semibold">{nft.beneficiary_name}</h1>
            </div>
            <span className="badge !bg-white/15 !text-white">
              <Lock size={11} /> Non-transferable
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs opacity-60 mb-0.5">Allocation</p>
              <p className="text-lg font-semibold">{allocation}</p>
            </div>
            <div>
              <p className="text-xs opacity-60 mb-0.5">Minted</p>
              <p className="text-lg font-semibold">
                {new Date(Number(nft.minted_at)).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs opacity-60 mb-0.5">Trust Status</p>
              <p className="text-lg font-semibold">
                {trust ? trustStatusLabel(trust.status) : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Conditions */}
      <div className="card mb-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <ScrollText size={16} className="text-green-primary" /> Conditions
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed">
          {nft.conditions_summary || "No conditions summary provided."}
        </p>
      </div>

      {/* Linked trust */}
      <div className="card mb-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Vault size={16} className="text-green-primary" /> Parent Trust
        </h3>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium truncate">{trust?.name ?? "Loading…"}</p>
            <p className="text-xs text-text-muted font-mono truncate">{nft.trust_id}</p>
          </div>
          <Link href={`/app/trust?id=${nft.trust_id}`} className="btn btn-secondary btn-sm shrink-0">
            View Trust
          </Link>
        </div>
        {trust && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="card-flat text-center">
              <p className="text-lg font-semibold">{(Number(trust.balance) / 1e9).toFixed(2)}</p>
              <p className="text-xs text-text-muted">SUI in Trust</p>
            </div>
            <div className="card-flat text-center">
              <p className="text-lg font-semibold">{trust.rules.filter((r) => r.isActive).length}</p>
              <p className="text-xs text-text-muted">Active Rules</p>
            </div>
            <div className="card-flat text-center">
              <p className="text-lg font-semibold">
                {(Number(trust.totalDistributed) / 1e9).toFixed(1)}
              </p>
              <p className="text-xs text-text-muted">Distributed</p>
            </div>
          </div>
        )}
      </div>

      {/* Request distribution */}
      {isOwner && trust && trust.status === 0 && (
        <RequestDistributionCard trustId={nft.trust_id} />
      )}
    </div>
  );
}

function RequestDistributionCard({ trustId }: { trustId: string }) {
  const { execute } = useTrusteaTransaction();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState("maintenance");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleRequest() {
    const mist = Math.round(Number(amount) * 1e9);
    if (!mist || mist <= 0 || !reason.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::trust::request_distribution`,
        arguments: [
          tx.object(trustId),
          tx.pure.u64(mist),
          tx.pure.string(reason),
          tx.pure.string(category),
          tx.object("0x6"),
        ],
      });
      await execute({ transaction: tx });
      setSent(true);
      setAmount("");
      setReason("");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-glow">
      <h3 className="font-semibold mb-1 flex items-center gap-2">
        <Send size={16} className="text-green-primary" /> Request a Distribution
      </h3>
      <p className="text-xs text-text-muted mb-4">
        Sent on-chain to the grantor and AI agent for review.
      </p>
      {sent ? (
        <div className="card-flat text-center py-6 animate-scale-in">
          <p className="font-medium text-green-primary mb-1">Request submitted</p>
          <p className="text-xs text-text-muted">The grantor and agent have been notified on-chain.</p>
          <button onClick={() => setSent(false)} className="btn btn-ghost btn-sm mt-3">
            New Request
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <input
                type="number"
                value={amount}
                min={0}
                step="0.1"
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted font-semibold">
                SUI
              </span>
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="health">Health</option>
              <option value="education">Education</option>
              <option value="maintenance">Maintenance</option>
              <option value="support">Support</option>
            </select>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why do you need this distribution?"
            rows={2}
          />
          {err && <p className="text-xs text-error break-all">{err}</p>}
          <button
            onClick={handleRequest}
            disabled={busy || !Number(amount) || !reason.trim()}
            className="btn btn-primary"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Submit Request
          </button>
        </div>
      )}
    </div>
  );
}


export default function BeneficiaryPage() {
  return (
    <Suspense fallback={null}>
      <BeneficiaryPageInner />
    </Suspense>
  );
}

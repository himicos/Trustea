"use client";

import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  useMyTrusts,
  useMyBeneficiaryNFTs,
  useMyTrustsDetails,
  nextUnlockMs,
  formatCountdown,
} from "@/hooks/use-trustea";
import { Vault, Fingerprint, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { Onboarding, useFirstRun } from "@/components/onboarding";
import { isDemoMode } from "@/lib/demo-mode";

export default function Dashboard() {
  const account = useCurrentAccount();
  const { data: trusts, isLoading: trustsLoading } = useMyTrusts();
  const { data: nfts, isLoading: nftsLoading } = useMyBeneficiaryNFTs();
  const [firstRun, dismissFirstRun] = useFirstRun();

  if (account && firstRun) {
    return <Onboarding onDone={dismissFirstRun} />;
  }

  if (!account) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="card-glow text-center max-w-sm animate-scale-in">
          <div className="w-16 h-16 rounded-2xl bg-green-surface flex items-center justify-center mx-auto mb-5">
            <Wallet size={28} className="text-green-primary" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Connect Your Wallet</h2>
          <p className="text-text-secondary text-sm leading-relaxed mb-1">
            Slush, Nightly, or sign in with Google.
          </p>
          <p className="text-text-muted text-xs">
            zkLogin available via Enoki
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-text-muted text-sm mt-1">
            {account.address.slice(0, 8)}...{account.address.slice(-6)}
          </p>
        </div>
        <Link href="/app/create" className="btn btn-primary">
          <Plus size={16} />
          New Trust
        </Link>
      </div>

      {/* Hero metrics card */}
      {trusts && trusts.length > 0 && <HeroMetrics trustCount={trusts.length} />}

      {/* Grantor trusts */}
      <section className="mb-10">
        <p className="section-label mb-3 px-1">Your Trusts</p>
        {trustsLoading ? (
          <div className="grid gap-3">
            <div className="skeleton h-20 rounded-2xl" />
            <div className="skeleton h-20 rounded-2xl" />
          </div>
        ) : trusts && trusts.length > 0 ? (
          <div className="grid gap-3">
            {trusts.map((t: { trustId: string; name: string; createdAt: number }) => (
              <Link
                key={t.trustId}
                href={`/app/trust?id=${t.trustId}`}
                className="card-elevated flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-green-surface flex items-center justify-center shrink-0 group-hover:bg-green-glow transition-colors">
                  <Vault size={18} className="text-green-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{t.name}</h3>
                  <p className="text-sm text-text-muted font-mono truncate">
                    {t.trustId.slice(0, 12)}...{t.trustId.slice(-6)}
                  </p>
                </div>
                <span className="badge badge-green shrink-0">Active</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card text-center py-12 animate-fade-up">
            <div className="w-14 h-14 rounded-2xl bg-green-surface flex items-center justify-center mx-auto mb-4">
              <Vault size={24} className="text-green-primary" />
            </div>
            <p className="font-bold text-text-primary mb-1">No trusts yet</p>
            <p className="text-sm text-text-muted mb-5">Create your first on-chain trust fund</p>
            <Link href="/app/create" className="btn btn-primary">
              <Plus size={14} /> Create Trust
            </Link>
          </div>
        )}
      </section>

      {/* Beneficiary NFTs */}
      <section>
        <p className="section-label mb-3 px-1">As Beneficiary</p>
        {nftsLoading ? (
          <div className="skeleton h-20 rounded-2xl" />
        ) : nfts && nfts.length > 0 ? (
          <div className="grid gap-3">
            {nfts.map(
              (nft: { objectId: string; fields: Record<string, unknown> }) => (
                <Link
                  key={nft.objectId}
                  href={`/app/beneficiary?id=${nft.objectId}`}
                  className="card-elevated flex items-center gap-4 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-info-surface flex items-center justify-center shrink-0">
                    <Fingerprint size={18} className="text-info" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">
                      {String(nft.fields.beneficiary_name ?? "Beneficiary")}
                    </h3>
                    <p className="text-sm text-text-muted font-mono truncate">
                      {nft.objectId.slice(0, 12)}...{nft.objectId.slice(-6)}
                    </p>
                  </div>
                </Link>
              ),
            )}
          </div>
        ) : (
          <div className="card text-center py-10 animate-fade-up delay-1">
            <div className="w-12 h-12 rounded-2xl bg-info-surface flex items-center justify-center mx-auto mb-3">
              <Fingerprint size={20} className="text-info" />
            </div>
            <p className="text-sm text-text-muted">Not a beneficiary of any trust yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function HeroMetrics({ trustCount }: { trustCount: number }) {
  const { data: details } = useMyTrustsDetails();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const tvl = (details ?? []).reduce((sum, t) => sum + Number(t.balance) / 1e9, 0);
  const distributed = (details ?? []).reduce(
    (sum, t) => sum + Number(t.totalDistributed) / 1e9,
    0,
  );
  const beneficiaries = (details ?? []).reduce((sum, t) => sum + t.beneficiaries.length, 0);

  // Compute next unlock from real rules; if none, fall back to a synthetic monthly
  // countdown in demo mode so the metric is always meaningful during a recording.
  const rawUnlock = details ? nextUnlockMs(details, now) : null;
  let unlock = rawUnlock;
  if (unlock === null && isDemoMode() && details && details.length > 0) {
    const base = details[0].createdAt > 0 ? details[0].createdAt : now;
    const period = 30 * 24 * 60 * 60 * 1000;
    const elapsed = Math.max(0, now - base);
    unlock = base + Math.max(1, Math.ceil(elapsed / period)) * period;
  }

  return (
    <div className="hero-card mb-8">
      <div className="hero-card-bg">
        <div className="orb" />
        <div className="orb" />
        <div className="orb" />
      </div>
      <div className="hero-card-content">
        <div>
          <p className="text-xs uppercase tracking-wider opacity-70 mb-1">
            Total Value Locked
          </p>
          <p className="text-5xl font-semibold display-type">
            {details ? tvl.toFixed(2) : "—"}
            <span className="text-xl ml-2 opacity-70">SUI</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-60">Next unlock</p>
          <p className="text-xl font-semibold">
            {unlock ? formatCountdown(unlock - now) : "—"}
          </p>
        </div>
      </div>
      <div className="hero-card-strip">
        <div>
          <span className="strip-value">{trustCount}</span>
          <span className="strip-label">Trusts</span>
        </div>
        <div>
          <span className="strip-value">{beneficiaries}</span>
          <span className="strip-label">Beneficiaries</span>
        </div>
        <div>
          <span className="strip-value">{distributed.toFixed(1)}</span>
          <span className="strip-label">SUI Distributed</span>
        </div>
        <div>
          <span className="strip-value">24/7</span>
          <span className="strip-label">AI Monitoring</span>
        </div>
      </div>
    </div>
  );
}

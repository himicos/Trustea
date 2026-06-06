"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";
import { useMyTrusts, useMyBeneficiaryNFTs } from "@/hooks/use-trustea";

export default function Dashboard() {
  const account = useCurrentAccount();
  const { data: trusts, isLoading: trustsLoading } = useMyTrusts();
  const { data: nfts, isLoading: nftsLoading } = useMyBeneficiaryNFTs();

  if (!account) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="card text-center max-w-md">
          <p className="text-text-secondary">
            Connect a wallet to see your trusts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      {/* Grantor trusts */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Your Trusts</h2>
        {trustsLoading ? (
          <div className="card animate-pulse h-24" />
        ) : trusts && trusts.length > 0 ? (
          <div className="space-y-3">
            {trusts.map((t: { trustId: string; name: string }) => (
              <a
                key={t.trustId}
                href={`/app/trust/${t.trustId}`}
                className="card block hover:border-border-strong transition-colors"
              >
                <h3 className="font-semibold">{t.name}</h3>
                <p className="text-sm text-text-muted font-mono">
                  {t.trustId.slice(0, 10)}...{t.trustId.slice(-6)}
                </p>
              </a>
            ))}
          </div>
        ) : (
          <div className="card text-center">
            <p className="text-text-secondary">
              No trusts created yet.
            </p>
          </div>
        )}
      </section>

      {/* Beneficiary NFTs */}
      <section>
        <h2 className="text-lg font-semibold mb-3">As Beneficiary</h2>
        {nftsLoading ? (
          <div className="card animate-pulse h-24" />
        ) : nfts && nfts.length > 0 ? (
          <div className="space-y-3">
            {nfts.map((nft: { objectId: string; fields: Record<string, unknown> }) => (
              <a
                key={nft.objectId}
                href={`/app/beneficiary/${nft.objectId}`}
                className="card block hover:border-border-strong transition-colors"
              >
                <h3 className="font-semibold">
                  {String(nft.fields.beneficiary_name ?? "Beneficiary")}
                </h3>
                <p className="text-sm text-text-muted font-mono">
                  {nft.objectId.slice(0, 10)}...{nft.objectId.slice(-6)}
                </p>
              </a>
            ))}
          </div>
        ) : (
          <div className="card text-center">
            <p className="text-text-secondary">
              You are not a beneficiary of any trust.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

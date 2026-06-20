"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@mysten/dapp-kit";
import {
  Sprout,
  Radar,
  BrainCircuit,
  SlidersHorizontal,
  Fingerprint,
  Orbit,
  Vault,
  CircleHelp,
} from "lucide-react";
import { useMyTrusts, useMyBeneficiaryNFTs } from "@/hooks/use-trustea";
import { HelpPanel } from "@/components/help-panel";

function TrusteaLogo({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 2000 2000" width={size} height={size}>
      <polygon fill="#10B981" points="928 781 1021 951 784.5 1371.97 1618 1371.97 1530.32 1544 509 1539 928 781" />
      <polygon fill="#059669" points="1618 1371.97 784.5 1371.97 874.93 1211 1346 1211 923.1 456 1110.06 456 1618 1371.97" />
      <polygon fill="#0D6E4F" points="418 1372.74 509 1539 928 781 1162.32 1211 1346 1211 923.1 456 418 1372.74" />
    </svg>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-[260px] flex flex-col">
        <div className="flex-1 w-full max-w-[900px] mx-auto px-8 py-8 pb-20">
          {children}
        </div>
      </main>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const { data: trusts } = useMyTrusts();
  const { data: nfts } = useMyBeneficiaryNFTs();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[260px] bg-sidebar-bg text-sidebar-text flex flex-col z-40">
      {/* Logo */}
      <div className="p-5 pb-4">
        <Link href="/app" className="flex items-center gap-2.5">
          <TrusteaLogo size={34} />
          <span className="text-lg font-semibold tracking-tight lowercase">trustea</span>
        </Link>
      </div>

      {/* Connect button — styled wrapper */}
      <div className="px-4 pb-5">
        <div className="connect-btn-wrap">
          <ConnectButton />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-5">
        <SidebarSection label="Grantor">
          <SidebarLink href="/app" icon={<Orbit size={16} />} active={pathname === "/app"}>
            Dashboard
          </SidebarLink>
          <SidebarLink href="/app/create" icon={<Sprout size={16} />} active={pathname === "/app/create"}>
            Create Trust
          </SidebarLink>
        </SidebarSection>

        {trusts && trusts.length > 0 && (
          <SidebarSection label="Your Trusts">
            {trusts.map((t: { trustId: string; name: string }) => (
              <SidebarLink
                key={t.trustId}
                href={`/app/trust?id=${t.trustId}`}
                icon={<Vault size={16} />}
                active={pathname?.includes(t.trustId) ?? false}
              >
                {t.name}
              </SidebarLink>
            ))}
          </SidebarSection>
        )}

        {nfts && nfts.length > 0 && (
          <SidebarSection label="Beneficiary">
            {nfts.map((nft: { objectId: string; fields: Record<string, unknown> }) => (
              <SidebarLink
                key={nft.objectId}
                href={`/app/beneficiary?id=${nft.objectId}`}
                icon={<Fingerprint size={16} />}
                active={pathname?.includes(nft.objectId) ?? false}
              >
                {String(nft.fields.beneficiary_name ?? "Trust")}
              </SidebarLink>
            ))}
          </SidebarSection>
        )}

        <SidebarSection label="Agent">
          <SidebarLink href="/app/agent" icon={<Radar size={16} />} active={pathname === "/app/agent"}>
            Activity
          </SidebarLink>
          <SidebarLink href="/app/memory" icon={<BrainCircuit size={16} />} active={pathname === "/app/memory"}>
            Memory
          </SidebarLink>
        </SidebarSection>
      </nav>

      <div className="p-4 border-t border-sidebar-hover space-y-0.5">
        <button
          onClick={() => setHelpOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
        >
          <CircleHelp size={16} />
          <span>Help</span>
        </button>
        <SidebarLink href="/app/settings" icon={<SlidersHorizontal size={16} />} active={pathname === "/app/settings"}>
          Settings
        </SidebarLink>
      </div>

      {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
    </aside>
  );
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="section-label text-sidebar-muted px-3 mb-1.5">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarLink({ href, icon, active, children }: {
  href: string; icon: React.ReactNode; active: boolean; children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
        active
          ? "bg-sidebar-active text-sidebar-accent font-medium"
          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
      }`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@mysten/dapp-kit";
import {
  Shield,
  Plus,
  Bot,
  Brain,
  Settings,
  Ticket,
} from "lucide-react";
import { useMyTrusts, useMyBeneficiaryNFTs } from "@/hooks/use-trustea";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-[260px] p-8 max-w-[1200px]">{children}</main>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const { data: trusts } = useMyTrusts();
  const { data: nfts } = useMyBeneficiaryNFTs();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[260px] bg-sidebar-bg text-sidebar-text flex flex-col z-40">
      {/* Logo */}
      <div className="p-5 pb-3">
        <Link href="/app" className="text-xl font-semibold">
          Trustea
        </Link>
      </div>

      {/* Wallet */}
      <div className="px-4 pb-4">
        <ConnectButton />
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        {/* Grantor section */}
        <SidebarSection label="GRANTOR">
          <SidebarLink href="/app" icon={<Shield size={16} />} active={pathname === "/app"}>
            Dashboard
          </SidebarLink>
          <SidebarLink href="/app/create" icon={<Plus size={16} />} active={pathname === "/app/create"}>
            Create Trust
          </SidebarLink>
        </SidebarSection>

        {/* Trusts */}
        {trusts && trusts.length > 0 && (
          <SidebarSection label="YOUR TRUSTS">
            {trusts.map((t: { trustId: string; name: string }) => (
              <SidebarLink
                key={t.trustId}
                href={`/app/trust/${t.trustId}`}
                icon={<Shield size={16} />}
                active={pathname?.includes(t.trustId) ?? false}
              >
                {t.name}
              </SidebarLink>
            ))}
          </SidebarSection>
        )}

        {/* Beneficiary NFTs */}
        {nfts && nfts.length > 0 && (
          <SidebarSection label="BENEFICIARY">
            {nfts.map((nft: { objectId: string; fields: Record<string, unknown> }) => (
              <SidebarLink
                key={nft.objectId}
                href={`/app/beneficiary/${nft.objectId}`}
                icon={<Ticket size={16} />}
                active={pathname?.includes(nft.objectId) ?? false}
              >
                {String(nft.fields.beneficiary_name ?? "Trust")}
              </SidebarLink>
            ))}
          </SidebarSection>
        )}

        {/* Agent */}
        <SidebarSection label="AGENT">
          <SidebarLink href="/app/agent" icon={<Bot size={16} />} active={pathname === "/app/agent"}>
            Activity Log
          </SidebarLink>
          <SidebarLink href="/app/memory" icon={<Brain size={16} />} active={pathname === "/app/memory"}>
            Memory
          </SidebarLink>
        </SidebarSection>
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-sidebar-active">
        <SidebarLink href="/app/settings" icon={<Settings size={16} />} active={pathname === "/app/settings"}>
          Settings
        </SidebarLink>
      </div>
    </aside>
  );
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-medium tracking-wider text-sidebar-muted px-3 mb-1">
        {label}
      </p>
      {children}
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  active,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
        active
          ? "bg-sidebar-active text-sidebar-text"
          : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

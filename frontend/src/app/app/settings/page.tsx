"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  SlidersHorizontal,
  Globe,
  Bell,
  Radar,
  HeartPulse,
  Wallet,
  Copy,
  ExternalLink,
} from "lucide-react";
import { PACKAGE_ID } from "@/hooks/use-trustea";

export default function SettingsPage() {
  const account = useCurrentAccount();

  return (
    <div className="max-w-2xl animate-fade-up">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-green-surface flex items-center justify-center">
          <SlidersHorizontal size={20} className="text-green-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Settings</h1>
          <p className="text-text-muted text-xs">Trust configuration &amp; preferences</p>
        </div>
      </div>

      {/* Connected account */}
      <p className="section-label mb-3 px-1">Account</p>
      <div className="card mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-green-surface flex items-center justify-center shrink-0">
              <Wallet size={18} className="text-green-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {account ? "Connected" : "Not connected"}
              </p>
              <p className="text-xs text-text-muted font-mono truncate">
                {account?.address ?? "Connect a wallet from the sidebar"}
              </p>
            </div>
          </div>
          {account && (
            <button
              onClick={() => navigator.clipboard.writeText(account.address)}
              className="btn btn-secondary btn-sm shrink-0"
              title="Copy address"
            >
              <Copy size={13} /> Copy
            </button>
          )}
        </div>
      </div>

      {/* Network */}
      <p className="section-label mb-3 px-1">Network</p>
      <div className="space-y-3 mb-6">
        <SettingRow
          icon={<Globe size={18} />}
          label="Sui Network"
          description="Where all transactions are sent"
          action={
            <div className="flex border border-border rounded-xl overflow-hidden">
              <button className="px-4 py-2 text-xs font-semibold bg-green-primary text-white">Testnet</button>
              <button className="px-4 py-2 text-xs font-semibold bg-surface text-text-muted border-l border-border" disabled>
                Mainnet
              </button>
            </div>
          }
        />
        <SettingRow
          icon={<ExternalLink size={18} />}
          label="Trustea Contract"
          description="Inspect the deployed Move package"
          action={
            <a
              href={`https://testnet.suivision.xyz/package/${PACKAGE_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <ExternalLink size={13} /> View
            </a>
          }
        />
      </div>

      {/* Agent */}
      <p className="section-label mb-3 px-1">AI Agent</p>
      <div className="space-y-3 mb-6">
        <SettingRow
          icon={<Radar size={18} />}
          label="Agent Cycle"
          description="How often the AI agent checks conditions"
          action={
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-primary">Every 6h</span>
              <span className="dot dot-active dot-pulse" />
            </div>
          }
        />
        <SettingRow
          icon={<Bell size={18} />}
          label="Notifications"
          description="DMS heartbeat reminders (coming soon)"
          action={<input type="checkbox" className="toggle" defaultChecked disabled />}
        />
        <SettingRow
          icon={<HeartPulse size={18} />}
          label="Auto-Heartbeat"
          description="Agent sends heartbeat on your behalf (coming soon)"
          action={<input type="checkbox" className="toggle" disabled />}
        />
      </div>

      <p className="text-xs text-text-muted text-center mt-10">
        Per-trust configuration is managed from the trust&apos;s page.
      </p>
    </div>
  );
}

function SettingRow({ icon, label, description, action }: {
  icon: React.ReactNode; label: string; description: string; action: React.ReactNode;
}) {
  return (
    <div className="card !p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-green-surface flex items-center justify-center text-green-primary shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm">{label}</p>
          <p className="text-xs text-text-muted">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

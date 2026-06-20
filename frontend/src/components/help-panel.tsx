"use client";

import { useState } from "react";
import {
  X,
  Vault,
  KeyRound,
  Signature,
  HeartPulse,
  Layers3,
  ChevronDown,
  RotateCcw,
  ExternalLink,
} from "lucide-react";

const SECTIONS = [
  {
    icon: Vault,
    title: "What is Trustea?",
    body: (
      <p>
        An on-chain trust fund that runs itself. Your assets sit in a Sui smart
        contract that enforces your distribution rules automatically — replacing
        ~$30,000/yr in trustee fees with about $2 in gas. Everything is
        auditable on-chain, forever.
      </p>
    ),
  },
  {
    icon: KeyRound,
    title: "Roles",
    body: (
      <ul className="space-y-1.5">
        <li><b className="text-text-primary">Grantor</b> — creates and funds the trust, writes rules, can veto anything within the override window.</li>
        <li><b className="text-text-primary">Beneficiary</b> — receives distributions when conditions are met; holds a soulbound NFT as proof, and can request funds on-chain.</li>
        <li><b className="text-text-primary">AI Agent</b> — monitors conditions every cycle and proposes distributions. Never moves money without the veto window passing.</li>
        <li><b className="text-text-primary">Protector</b> — optional independent role that can veto and pause.</li>
        <li><b className="text-text-primary">Successor Grantor</b> — takes over if you become incapacitated.</li>
      </ul>
    ),
  },
  {
    icon: Signature,
    title: "Rules in plain English",
    body: (
      <p>
        Type rules like{" "}
        <span className="text-green-light">
          &quot;Release 100 SUI to Alice when she turns 25&quot;
        </span>
        . AI translates them into on-chain logic and shows its interpretation,
        a confidence score, and warnings — before you sign anything. Rules bind
        to a beneficiary and live in the contract.
      </p>
    ),
  },
  {
    icon: HeartPulse,
    title: "Dead Man's Switch",
    body: (
      <p>
        An on-chain heartbeat. You check in every N days; miss the deadline and
        a grace period starts, then trusted activators can vote to trigger
        succession. The protector gets a veto window before control transfers
        to your successor. Every phase is visible on the trust&apos;s DMS tab.
      </p>
    ),
  },
  {
    icon: Layers3,
    title: "The stack",
    body: (
      <ul className="space-y-1.5">
        <li><b className="text-text-primary">Sui</b> — smart contracts hold assets and enforce rules.</li>
        <li><b className="text-text-primary">Walrus</b> — verifiable storage for documents and audit logs.</li>
        <li><b className="text-text-primary">Seal</b> — encryption with time-lock policies; documents auto-decrypt for beneficiaries when conditions are met.</li>
        <li><b className="text-text-primary">MemWal</b> — persistent agent memory on Walrus; every decision is informed by full history.</li>
      </ul>
    ),
  },
] as const;

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(0);

  function replayIntro() {
    localStorage.removeItem("trustea-onboarded");
    window.location.assign("/app");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card-glow w-full max-w-lg max-h-[85vh] overflow-y-auto !p-0 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <h2 className="text-lg font-semibold">How Trustea Works</h2>
          <button onClick={onClose} className="btn btn-ghost !p-2 !min-h-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-3 py-3">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon;
            const isOpen = open === i;
            return (
              <div key={s.title}>
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.04] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-surface flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-green-light" />
                  </div>
                  <span className="font-medium text-sm flex-1">{s.title}</span>
                  <ChevronDown
                    size={15}
                    className={`text-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-3 pb-4 pl-14 text-sm text-text-secondary leading-relaxed animate-fade-up">
                    {s.body}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <button onClick={replayIntro} className="btn btn-ghost btn-sm">
            <RotateCcw size={13} /> Replay intro
          </button>
          <a
            href="https://github.com/himicos/Trustea"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            <ExternalLink size={13} /> Docs &amp; Source
          </a>
        </div>
      </div>
    </div>
  );
}

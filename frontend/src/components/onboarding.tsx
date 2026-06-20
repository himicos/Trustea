"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Vault,
  KeyRound,
  BrainCircuit,
  Sparkles,
  ArrowRight,
  Check,
} from "lucide-react";

const STORAGE_KEY = "trustea-onboarded";

export function useFirstRun(): [boolean, () => void] {
  const [firstRun, setFirstRun] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setFirstRun(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setFirstRun(false);
  };

  return [firstRun, dismiss];
}

const SLIDES = [
  {
    icon: Vault,
    title: "Welcome to Trustea",
    body: "A trust fund that runs itself. Smart contracts on Sui hold the assets, enforce your rules, and distribute funds — replacing $30,000/yr in trustee fees with about $2 in gas.",
    points: [
      "Assets live in an on-chain trust you control",
      "Rules execute automatically, no middlemen",
      "Everything is auditable, forever",
    ],
  },
  {
    icon: KeyRound,
    title: "Three Roles, One Trust",
    body: "You are the grantor — you create and fund the trust. Beneficiaries receive distributions and hold a soulbound NFT as proof. An optional protector can veto and pause.",
    points: [
      "Grantor: creates rules, funds, can override",
      "Beneficiary: receives funds when conditions are met",
      "Protector: independent safety brake",
    ],
  },
  {
    icon: BrainCircuit,
    title: "An AI Trustee That Remembers",
    body: "The AI agent monitors conditions every cycle and proposes distributions. Its memory persists on Walrus via MemWal — every decision is informed by the full history and you get a 48-hour veto window on everything it proposes.",
    points: [
      "Documents encrypted with Seal, stored on Walrus",
      "Agent memory survives restarts — on Walrus too",
      "You always have the final say",
    ],
  },
  {
    icon: Sparkles,
    title: "Rules in Plain English",
    body: "\"Release 100 SUI to Alice when she turns 25.\" Type it like that — AI translates it into on-chain logic with a confidence score before anything is deployed.",
    points: [
      "No legal jargon, no code",
      "AI shows its interpretation before you sign",
      "Deploy a full trust in under two minutes",
    ],
  },
] as const;

export function Onboarding({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const current = SLIDES[slide];
  const Icon = current.icon;
  const isLast = slide === SLIDES.length - 1;

  return (
    <div className="flex items-center justify-center min-h-[80vh] animate-fade-in">
      <div className="max-w-md w-full">
        <div className="card-glow text-center !p-8 animate-scale-in" key={slide}>
          <div className="w-16 h-16 rounded-2xl bg-green-surface flex items-center justify-center mx-auto mb-5">
            <Icon size={28} className="text-green-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-3">{current.title}</h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-6">{current.body}</p>
          <div className="space-y-2.5 text-left mb-2">
            {current.points.map((p) => (
              <div key={p} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-green-surface flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={11} className="text-green-primary" strokeWidth={3} />
                </div>
                <p className="text-sm text-text-secondary">{p}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 my-6">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`h-2 rounded-full transition-all ${
                i === slide ? "w-6 bg-green-primary" : "w-2 bg-border-strong"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onDone} className="btn btn-ghost flex-1">
            Skip
          </button>
          {!isLast ? (
            <button onClick={() => setSlide(slide + 1)} className="btn btn-primary flex-[2]">
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => {
                onDone();
                router.push("/app/create");
              }}
              className="btn btn-primary flex-[2]"
            >
              Create Your First Trust <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

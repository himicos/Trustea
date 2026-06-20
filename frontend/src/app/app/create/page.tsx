"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useTrusteaTransaction, useTranslateRule, PACKAGE_ID } from "@/hooks/use-trustea";
import { isDemoMode, DEMO_RULE_SUGGESTIONS } from "@/lib/demo-mode";
import {
  Plus,
  Trash2,
  Landmark,
  HeartPulse,
  Signature,
  KeyRound,
  Fingerprint,
  ArrowRight,
  ArrowLeft,
  Check,
  Wallet,
  Sparkles,
  HandCoins,
  AlertTriangle,
  Loader2,
} from "lucide-react";

const STEPS = ["Basics", "Roles", "Beneficiaries", "Rules", "Safety", "Fund"] as const;

interface BeneficiaryDraft {
  address: string;
  name: string;
  allocation: string; // SUI or %
  isPercentage: boolean;
  conditions: string;
}

interface TranslatedRule {
  ruleType: string;
  beneficiary?: string;
  amount: number;
  isPercentage: boolean;
  conditionDescription: string;
  conditionParams: {
    timestamp?: number;
    periodMs?: number;
    nftType?: string;
  };
}

interface RuleDraft {
  text: string;
  translation?: {
    rule: TranslatedRule;
    explanation: string;
    confidence: number;
    warnings: string[];
  };
  beneficiaryIndex: number;
  translating?: boolean;
}

const RULE_TYPE_NUM: Record<string, number> = {
  age: 0,
  time: 1,
  credential: 2,
  periodic: 3,
  // local models use freeform names; map common synonyms
  recurring: 3,
  recurringpayment: 3,
  monthly: 3,
  schedule: 3,
  date: 1,
  milestone: 2,
  // compound/custom stored as credential rules; full logic lives in description + agent memory
  compound: 2,
  custom: 2,
};

function ruleTypeNum(ruleType: string): number {
  const key = ruleType.toLowerCase().replace(/[^a-z]/g, "");
  if (key in RULE_TYPE_NUM) return RULE_TYPE_NUM[key];
  for (const [k, v] of Object.entries(RULE_TYPE_NUM)) {
    if (key.includes(k)) return v;
  }
  return 2;
}

export default function CreateTrustPage() {
  const account = useCurrentAccount();
  const router = useRouter();
  const suiClient = useSuiClient();
  const { execute } = useTrusteaTransaction();
  const translateRule = useTranslateRule();

  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isRevocable, setIsRevocable] = useState(true);
  const [overridePeriodHours, setOverridePeriodHours] = useState(48);

  const [agentAddress, setAgentAddress] = useState("");
  const [successorGrantor, setSuccessorGrantor] = useState("");
  const [trustProtector, setTrustProtector] = useState("");

  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryDraft[]>([]);

  const [rules, setRules] = useState<RuleDraft[]>([{ text: "", beneficiaryIndex: 0 }]);

  // Demo polish: pre-fill suggested values when ?demo=1 is on (one-time on mount)
  useEffect(() => {
    if (!isDemoMode()) return;
    setName((cur) => cur || "Demo Trust");
    setDescription((cur) => cur || "AI-managed family trust for the demo");
    setRules((cur) =>
      cur.map((r, i) =>
        i === 0 && !r.text ? { ...r, text: DEMO_RULE_SUGGESTIONS[0] } : r,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [dmsEnabled, setDmsEnabled] = useState(false);
  const [dmsHeartbeatDays, setDmsHeartbeatDays] = useState(90);
  const [dmsGraceDays, setDmsGraceDays] = useState(14);
  const [dmsVetoDays, setDmsVetoDays] = useState(7);
  const [dmsThreshold, setDmsThreshold] = useState(1);
  const [dmsActivators, setDmsActivators] = useState<string[]>([""]);

  const [depositSui, setDepositSui] = useState("");

  const [deployPhase, setDeployPhase] = useState<"idle" | "creating" | "configuring" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!account) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="card-glow text-center max-w-sm animate-scale-in">
          <div className="w-16 h-16 rounded-2xl bg-green-surface flex items-center justify-center mx-auto mb-4">
            <Wallet size={28} className="text-green-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Connect Wallet</h2>
          <p className="text-text-secondary text-sm">Connect to create your first on-chain trust.</p>
        </div>
      </div>
    );
  }

  async function handleTranslateRule(index: number) {
    const draft = rules[index];
    if (!draft?.text.trim() || draft.translating) return;
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, translating: true } : r)));
    try {
      const result = await translateRule.mutateAsync(draft.text);
      setRules((prev) =>
        prev.map((r, i) => (i === index ? { ...r, translation: result, translating: false } : r)),
      );
    } catch {
      setRules((prev) => prev.map((r, i) => (i === index ? { ...r, translating: false } : r)));
    }
  }

  async function handleDeploy() {
    setError(null);
    setDeployPhase("creating");
    try {
      // ── Tx 1: create the trust ──
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::trust::create_trust`,
        arguments: [
          tx.pure.string(name),
          tx.pure.string(description),
          tx.pure.address(agentAddress || account!.address),
          tx.pure.u64(overridePeriodHours * 60 * 60 * 1000),
          tx.pure.bool(isRevocable),
          tx.pure.option("address", successorGrantor || null),
          tx.pure.option("address", trustProtector || null),
          tx.object("0x6"),
        ],
      });
      const result = await execute({ transaction: tx });

      const details = await (suiClient as any).waitForTransaction({
        digest: result.digest,
        options: { showObjectChanges: true },
      });
      const created = (details.objectChanges ?? []).find(
        (c: { type: string; objectType?: string }) =>
          c.type === "created" && c.objectType?.endsWith("::trust::Trust"),
      ) as { objectId: string } | undefined;
      if (!created) throw new Error("Trust object not found in transaction effects");
      const trustId = created.objectId;

      // ── Tx 2: beneficiaries, rules, DMS, funding — one PTB ──
      const validBens = beneficiaries.filter((b) => b.address.trim());
      const validRules = rules.filter(
        (r) => r.translation && validBens[r.beneficiaryIndex] && r.translation.rule.amount > 0,
      );
      const validActivators = dmsActivators.filter(Boolean);
      const depositMist = Math.round(Number(depositSui || 0) * 1e9);
      const needsConfig =
        validBens.length > 0 ||
        validRules.length > 0 ||
        (dmsEnabled && successorGrantor && validActivators.length > 0) ||
        depositMist > 0;

      if (needsConfig) {
        setDeployPhase("configuring");
        const tx2 = new Transaction();

        for (const b of validBens) {
          const allocationNum = Number(b.allocation || 0);
          tx2.moveCall({
            target: `${PACKAGE_ID}::trust::add_beneficiary`,
            arguments: [
              tx2.object(trustId),
              tx2.pure.address(b.address.trim()),
              tx2.pure.string(b.name || "Beneficiary"),
              tx2.pure.string(b.conditions || ""),
              tx2.pure.u64(
                b.isPercentage ? Math.round(allocationNum * 100) : Math.round(allocationNum * 1e9),
              ),
              tx2.pure.bool(b.isPercentage),
              tx2.object("0x6"),
            ],
          });
        }

        for (const r of validRules) {
          const t = r.translation!;
          const ben = validBens[r.beneficiaryIndex];
          const conditionValue = Math.round(
            t.rule.conditionParams?.timestamp ?? t.rule.conditionParams?.periodMs ?? 0,
          );
          tx2.moveCall({
            target: `${PACKAGE_ID}::trust::add_rule`,
            arguments: [
              tx2.object(trustId),
              tx2.pure.u8(ruleTypeNum(t.rule.ruleType)),
              tx2.pure.address(ben.address.trim()),
              tx2.pure.u64(
                t.rule.isPercentage
                  ? Math.round(t.rule.amount * 100)
                  : Math.round(t.rule.amount * 1e9),
              ),
              tx2.pure.bool(t.rule.isPercentage),
              tx2.pure.u64(conditionValue),
              tx2.pure.string(t.rule.conditionDescription || r.text),
            ],
          });
        }

        if (dmsEnabled && successorGrantor && validActivators.length > 0) {
          tx2.moveCall({
            target: `${PACKAGE_ID}::trust::configure_dms`,
            arguments: [
              tx2.object(trustId),
              tx2.pure.u64(dmsHeartbeatDays * 24 * 60 * 60 * 1000),
              tx2.pure.u64(dmsGraceDays * 24 * 60 * 60 * 1000),
              tx2.pure.u64(dmsVetoDays * 24 * 60 * 60 * 1000),
              tx2.pure.u8(Math.min(dmsThreshold, validActivators.length)),
              tx2.pure.vector("address", validActivators),
              tx2.object("0x6"),
            ],
          });
        }

        if (depositMist > 0) {
          const [coin] = tx2.splitCoins(tx2.gas, [tx2.pure.u64(depositMist)]);
          tx2.moveCall({
            target: `${PACKAGE_ID}::trust::deposit`,
            arguments: [tx2.object(trustId), coin],
          });
        }

        await execute({ transaction: tx2 });
      }

      setDeployPhase("done");
      router.push(`/app/trust?id=${trustId}`);
    } catch (err) {
      setError(String(err));
      setDeployPhase("idle");
    }
  }

  const canNext =
    step === 0 ? name.trim().length > 0
    : step === 4 ? !dmsEnabled || (successorGrantor.length > 0 && dmsActivators.some(Boolean))
    : true;

  const isLast = step === STEPS.length - 1;
  const deploying = deployPhase === "creating" || deployPhase === "configuring";

  return (
    <div className="max-w-xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8 animate-fade-up">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1 flex-1 min-w-0">
            <button
              onClick={() => i < step && !deploying && setStep(i)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all ${
                i < step
                  ? "bg-green-light text-white cursor-pointer"
                  : i === step
                    ? "bg-green-primary text-white shadow-lg shadow-green-glow"
                    : "bg-surface text-text-muted border border-border"
              }`}
            >
              {i < step ? <Check size={13} strokeWidth={3} /> : i + 1}
            </button>
            <span className={`text-[11px] font-medium hidden md:block truncate ${i <= step ? "text-text-primary" : "text-text-muted"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 rounded-full ${i < step ? "bg-green-light" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Form card */}
      <div className="card mb-6 animate-scale-in">
        {step === 0 && (
          <div className="space-y-5">
            <StepHeader
              icon={<Landmark size={20} className="text-green-primary" />}
              bg="bg-green-surface"
              title="Name Your Trust"
              subtitle="The basics."
            />
            <div>
              <Label>Trust Name</Label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Family Trust Alpha" autoFocus />
            </div>
            <div>
              <Label>Description</Label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Purpose of this trust..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Override Period</Label>
                <div className="relative">
                  <input type="number" value={overridePeriodHours}
                    onChange={(e) => setOverridePeriodHours(Number(e.target.value))}
                    min={1} />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted">hrs</span>
                </div>
                <Hint>Window to veto AI-proposed distributions</Hint>
              </div>
              <div>
                <Label>Type</Label>
                <div className="flex border border-border rounded-xl overflow-hidden">
                  <button onClick={() => setIsRevocable(true)}
                    className={`flex-1 py-3 text-sm font-medium transition-all ${
                      isRevocable ? "bg-green-primary text-white" : "bg-surface text-text-muted hover:bg-background"
                    }`}>
                    Revocable
                  </button>
                  <button onClick={() => setIsRevocable(false)}
                    className={`flex-1 py-3 text-sm font-medium transition-all border-l border-border ${
                      !isRevocable ? "bg-green-primary text-white" : "bg-surface text-text-muted hover:bg-background"
                    }`}>
                    Irrevocable
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <StepHeader
              icon={<KeyRound size={20} className="text-info" />}
              bg="bg-info-surface"
              title="Assign Roles"
              subtitle="Who manages this trust? All optional."
            />
            <div>
              <Label>AI Agent</Label>
              <input type="text" value={agentAddress} onChange={(e) => setAgentAddress(e.target.value)}
                placeholder={`Defaults to you (${account.address.slice(0, 8)}...)`}
                className="font-mono text-sm" />
              <Hint>Proposes distributions automatically</Hint>
            </div>
            <div>
              <Label>Successor Grantor</Label>
              <input type="text" value={successorGrantor} onChange={(e) => setSuccessorGrantor(e.target.value)}
                placeholder="0x..." className="font-mono text-sm" />
              <Hint>Takes over if you become incapacitated</Hint>
            </div>
            <div>
              <Label>Trust Protector</Label>
              <input type="text" value={trustProtector} onChange={(e) => setTrustProtector(e.target.value)}
                placeholder="0x..." className="font-mono text-sm" />
              <Hint>Oversight role — can veto &amp; pause</Hint>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <StepHeader
              icon={<Fingerprint size={20} className="text-green-primary" />}
              bg="bg-green-surface"
              title="Beneficiaries"
              subtitle="Who receives distributions. Each gets a soulbound NFT."
            />
            {beneficiaries.length === 0 && (
              <p className="text-sm text-text-muted text-center py-3">
                No beneficiaries yet — you can also add them later.
              </p>
            )}
            <div className="space-y-4">
              {beneficiaries.map((b, i) => (
                <div key={i} className="card-flat space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="badge badge-green">Beneficiary {i + 1}</span>
                    <button
                      onClick={() => setBeneficiaries(beneficiaries.filter((_, j) => j !== i))}
                      className="btn-ghost btn !min-h-0 !p-1.5 text-text-muted hover:text-error">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Name</Label>
                      <input type="text" value={b.name}
                        onChange={(e) => updateBen(i, { name: e.target.value })}
                        placeholder="Alice" />
                    </div>
                    <div>
                      <Label>Wallet Address</Label>
                      <input type="text" value={b.address}
                        onChange={(e) => updateBen(i, { address: e.target.value })}
                        placeholder="0x..." className="font-mono text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Allocation</Label>
                      <div className="flex gap-2">
                        <input type="number" value={b.allocation} min={0}
                          onChange={(e) => updateBen(i, { allocation: e.target.value })}
                          placeholder="0" />
                        <button
                          onClick={() => updateBen(i, { isPercentage: !b.isPercentage })}
                          className="btn btn-secondary !min-h-0 !px-4 shrink-0 text-sm font-semibold">
                          {b.isPercentage ? "%" : "SUI"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label>Conditions Summary</Label>
                      <input type="text" value={b.conditions}
                        onChange={(e) => updateBen(i, { conditions: e.target.value })}
                        placeholder="e.g. monthly stipend while enrolled" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setBeneficiaries([...beneficiaries, { address: "", name: "", allocation: "", isPercentage: false, conditions: "" }])}
              className="btn btn-secondary btn-sm">
              <Plus size={14} /> Add Beneficiary
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <StepHeader
              icon={<Signature size={20} className="text-green-primary" />}
              bg="bg-green-surface"
              title="Distribution Rules"
              subtitle="Write them in plain English. AI translates to on-chain logic."
            />
            <div className="space-y-4">
              {rules.map((rule, i) => (
                <div key={i}>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Sparkles size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-green-light" />
                      <input type="text" value={rule.text}
                        onChange={(e) => updateRule(i, { text: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && handleTranslateRule(i)}
                        placeholder='"Release 100 SUI to Alice when she turns 25"'
                        className="!pl-10" />
                    </div>
                    <button onClick={() => handleTranslateRule(i)}
                      className="btn btn-primary !min-h-0 !px-4 shrink-0"
                      disabled={rule.translating || !rule.text.trim()}>
                      {rule.translating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    </button>
                    {rules.length > 1 && (
                      <button onClick={() => setRules(rules.filter((_, j) => j !== i))}
                        className="btn btn-secondary !min-h-0 !px-3 shrink-0">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {rule.translation && (
                    <div className="mt-2 card-glow !p-4 animate-fade-up">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="badge badge-green capitalize">{rule.translation.rule.ruleType}</span>
                          <span className="font-semibold text-sm">
                            {rule.translation.rule.isPercentage
                              ? `${rule.translation.rule.amount}%`
                              : `${rule.translation.rule.amount} SUI`}
                          </span>
                        </div>
                        <ConfidenceBar value={rule.translation.confidence} />
                      </div>
                      <p className="text-sm text-text-secondary">{rule.translation.explanation}</p>
                      {rule.translation.warnings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {rule.translation.warnings.map((w, j) => (
                            <p key={j} className="text-xs text-warning flex items-center gap-1.5">
                              <AlertTriangle size={11} className="shrink-0" /> {w}
                            </p>
                          ))}
                        </div>
                      )}
                      {beneficiaries.filter((b) => b.address.trim()).length > 0 ? (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-text-muted">Applies to:</span>
                          <select
                            value={rule.beneficiaryIndex}
                            onChange={(e) => updateRule(i, { beneficiaryIndex: Number(e.target.value) })}
                            className="!w-auto !py-1.5 !px-3 text-sm">
                            {beneficiaries
                              .filter((b) => b.address.trim())
                              .map((b, j) => (
                                <option key={j} value={j}>
                                  {b.name || `${b.address.slice(0, 8)}...`}
                                </option>
                              ))}
                          </select>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-warning flex items-center gap-1.5">
                          <AlertTriangle size={11} /> Add a beneficiary in the previous step to deploy this rule on-chain.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setRules([...rules, { text: "", beneficiaryIndex: 0 }])}
              className="btn btn-secondary btn-sm"><Plus size={14} /> Add Rule</button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <StepHeader
                icon={<HeartPulse size={20} className="text-error" />}
                bg="bg-error-surface"
                title="Dead Man's Switch"
                subtitle="Automatic succession."
              />
              <input
                type="checkbox"
                className="toggle"
                checked={dmsEnabled}
                onChange={(e) => setDmsEnabled(e.target.checked)}
              />
            </div>

            {dmsEnabled && (
              <div className="space-y-4 animate-fade-up">
                {!successorGrantor && (
                  <div className="card-flat !border-warning/40 !bg-warning-surface">
                    <p className="text-sm text-warning font-medium">Set a Successor Grantor in the Roles step first.</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Heartbeat</Label>
                    <div className="relative">
                      <input type="number" value={dmsHeartbeatDays}
                        onChange={(e) => setDmsHeartbeatDays(Number(e.target.value))}
                        min={1} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">d</span>
                    </div>
                  </div>
                  <div>
                    <Label>Grace</Label>
                    <div className="relative">
                      <input type="number" value={dmsGraceDays}
                        onChange={(e) => setDmsGraceDays(Number(e.target.value))}
                        min={1} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">d</span>
                    </div>
                  </div>
                  <div>
                    <Label>Veto</Label>
                    <div className="relative">
                      <input type="number" value={dmsVetoDays}
                        onChange={(e) => setDmsVetoDays(Number(e.target.value))}
                        min={1} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">d</span>
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Votes to trigger</Label>
                  <input type="number" value={dmsThreshold}
                    onChange={(e) => setDmsThreshold(Number(e.target.value))}
                    min={1} max={Math.max(1, dmsActivators.filter(Boolean).length)} />
                </div>
                <div>
                  <Label>Activators <span className="text-text-muted font-normal">({dmsActivators.filter(Boolean).length})</span></Label>
                  <div className="space-y-2">
                    {dmsActivators.map((addr, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="text" value={addr}
                          onChange={(e) => { const n = [...dmsActivators]; n[i] = e.target.value; setDmsActivators(n); }}
                          placeholder="0x..." className="font-mono text-sm" />
                        {dmsActivators.length > 1 && (
                          <button onClick={() => setDmsActivators(dmsActivators.filter((_, j) => j !== i))}
                            className="btn btn-secondary !min-h-0 !px-3 shrink-0">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setDmsActivators([...dmsActivators, ""])}
                    className="btn btn-ghost btn-sm mt-2"><Plus size={14} /> Add</button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <StepHeader
              icon={<HandCoins size={20} className="text-green-primary" />}
              bg="bg-green-surface"
              title="Fund &amp; Deploy"
              subtitle="Initial deposit, then everything goes on-chain."
            />
            <div>
              <Label>Initial Deposit (optional)</Label>
              <div className="relative">
                <input type="number" value={depositSui} min={0} step="0.1"
                  onChange={(e) => setDepositSui(e.target.value)}
                  placeholder="0.0" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-text-muted font-semibold">SUI</span>
              </div>
            </div>

            {/* Review summary */}
            <div className="card-flat space-y-2.5 text-sm">
              <ReviewRow label="Trust" value={name || "—"} />
              <ReviewRow label="Type" value={isRevocable ? "Revocable" : "Irrevocable"} />
              <ReviewRow label="Beneficiaries" value={String(beneficiaries.filter((b) => b.address.trim()).length)} />
              <ReviewRow label="Rules" value={String(rules.filter((r) => r.translation).length)} />
              <ReviewRow label="Dead Man's Switch" value={dmsEnabled && successorGrantor ? `${dmsHeartbeatDays}d heartbeat` : "Off"} />
              <ReviewRow label="Initial Deposit" value={depositSui ? `${depositSui} SUI` : "None"} />
            </div>

            <p className="text-xs text-text-muted">
              Two signatures: one creates the trust, one configures beneficiaries, rules, safety and funding in a single transaction.
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="card !border-error/40 !bg-error-surface !p-4 mb-4 animate-fade-up">
          <p className="text-sm text-error font-medium break-all">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 animate-fade-up delay-2">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} disabled={deploying}
            className="btn btn-secondary flex-1">
            <ArrowLeft size={16} /> Back
          </button>
        )}
        {!isLast ? (
          <button onClick={() => setStep(step + 1)} disabled={!canNext}
            className="btn btn-primary flex-1">
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={handleDeploy} disabled={deploying || !name.trim()}
            className="btn btn-primary flex-1">
            {deployPhase === "creating" && <><Loader2 size={16} className="animate-spin" /> Creating trust…</>}
            {deployPhase === "configuring" && <><Loader2 size={16} className="animate-spin" /> Configuring on-chain…</>}
            {(deployPhase === "idle" || deployPhase === "done") && <>Deploy Trust <Check size={16} /></>}
          </button>
        )}
      </div>
    </div>
  );

  function updateBen(i: number, patch: Partial<BeneficiaryDraft>) {
    setBeneficiaries((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }
  function updateRule(i: number, patch: Partial<RuleDraft>) {
    setRules((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "bg-green-light" : pct >= 70 ? "bg-warning" : "bg-error";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-text-muted font-mono">{pct}%</span>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function StepHeader({ icon, bg, title, subtitle }: {
  icon: React.ReactNode; bg: string; title: string; subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-text-primary mb-1.5">{children}</label>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-text-muted mt-1">{children}</p>;
}

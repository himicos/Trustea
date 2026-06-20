# Demo Voice-Over Script — Sui Overflow 2026

**Total runtime: 5:00** (pitch 2:00 + demo 3:00)
**Recording**: voice + screen capture
**Read pace**: ~140 words per minute (conversational, not rushed)

Each line = roughly 1 breath. `[stage]` notes are not spoken.

---

## PART 1 — Pitch (2:00)

> Open `~/Trustea/pitch.html`. Press **E** to enter explainer mode. Begin recording when slide 1 (cover) is active.

### Slide 1 · Cover (0:00 → 0:15) — 15s

[hold on cover for 2s, then speak]

> *"This is trustea — an AI trustee with decades-long memory, powered by Walrus."*

> *"You write rules in plain English. The AI remembers every decision. The contract enforces them. Forever."*

[press → for slide 2]

### Slide 2 · Problem (0:15 → 0:40) — 25s

> *"Thirteen trillion dollars sits in US private trusts today."*

> *"Administering them costs fifteen to thirty thousand dollars a year on a one-million dollar trust. That's two percent of assets — every year, forever."*

> *"Why? Because the layer between the grantor and the beneficiary is still paper, phone calls, and lawyer interpretation."*

> *"On a five-million dollar trust over thirty years, that's three hundred ninety thousand dollars in admin fees alone."*

[press →]

### Slide 3 · Solution (0:40 → 1:00) — 20s

> *"Trustea replaces that layer with an AI trustee that remembers every decision forever."*

> *"The grantor writes rules in English. Our AI translates them into on-chain logic. A Sui Move contract executes them. Every decision is encrypted on Walrus, and the human keeps a forty-eight hour veto on every action the AI proposes."*

[press →]

### Slide 4 · How it works (1:00 → 1:20) — 20s

> *"Three steps."*

> *"One — you write the rule. Two — the AI trustee monitors twenty-four seven, proposes distributions, and you veto if needed. Three — every action executes on-chain and gets encrypted on Walrus via MemWal. Reconstructable fifty years from now."*

[press →]

### Slide 5 · Why memory matters (1:20 → 1:40) — 20s

> *"This is what makes trustea different."*

> *"In year one, the agent is cold-start — decisions are mechanical. By year five, after sixty plus decisions, the agent recalls every prior cycle. Before proposing anything new, it asks itself: have I seen this pattern before?"*

> *"The memory loop is what makes the trustee smarter over decades. That's the Walrus moment."*

[press →]

### Slide 6 · Architecture (1:40 → 1:55) — 15s

> *"Four primitives. Move is the source of truth. Walrus stores documents and logs. Seal handles identity-based encryption — only the grantor and beneficiaries decrypt. And MemWal closes the feedback loop — every decision teaches the next."*

> *"Nothing is held by us. Every layer is verifiable on Sui."*

[press →]

### Slide 7 · Proof (1:55 → 2:00) — 5s

> *"Not a prototype. Six modules, thirty-three tests passing, deployed on Sui testnet right now. Let me show you."*

[Stop pitch. Switch to live demo browser. Begin Part 2.]

---

## PART 2 — Live demo (2:00 → 5:00)

> URL: **https://trustea.fawesome.dev** — wallet pre-seeded (burner). Have `~/Desktop/will.txt` ready.

### 0:00 → 0:20 — Landing & live proof (Tab 1)

[On landing page, scroll once]

> *"Walrus-hosted. HTTPS-signed. Live."*

> *"The green pill at the top isn't decoration — it links directly to the deployed contract on Sui testnet. Click it and you can verify every transaction yourself."*

[Click the LIVE pill — Tab 4 opens with SuiVision package page. Spend 2 seconds looking, then close that tab.]

[Back on landing, scroll past Why Memory Matters section briefly]

> *"This is the section we just walked through — the agent's memory compounds year over year."*

[Click **Open App** in nav]

### 0:20 → 0:50 — App dashboard (Tab 2)

[Dashboard loads. Hero card visible: TVL, Trusts, Beneficiaries]

> *"I'm connected with a burner wallet that already has one trust."*

> *"Total value locked, number of trusts, beneficiaries, and on the right — next unlock countdown."*

[Hover briefly over Walrus Live Demo Trust row]

> *"Now let me create a new one. This is the hero flow."*

[Click **+ New Trust**]

### 0:50 → 1:50 — Create wizard (the AI moment)

[Step 1 Basics]

> *"Name it — Demo Trust. Description — AI-managed trust for the demo."*

[Fill, Continue. Step 2 skip with Continue. Step 3 Beneficiaries]

> *"Skip roles for brevity. Add a beneficiary — Alice, paste her address, allocate point one SUI."*

[Continue → Step 4 Rules]

> *"This is the hero moment. I'm not picking from a dropdown. I'm not coding. I'm writing in plain English."*

[Type slowly into the rule field:]

> **"Release 100 SUI to Alice every month while she is enrolled in university"**

[Press Enter or sparkle button. Wait 1-2 seconds for Groq.]

> *"The translator runs against Groq's Llama seventy billion model. It returns structured on-chain logic in about a second."*

[Card appears: ruleType periodic, 100 SUI, confidence ~90%]

> *"It correctly identified this as a periodic rule, monthly cadence, conditioned on a university enrollment credential. Confidence ninety percent. If it were lower, I'd see explicit warnings before deploying."*

[Continue → skip safety → Step 6 Fund]

> *"Deposit zero point zero two SUI to test. Deploy Trust."*

[Click Deploy. Two wallet signatures auto-fire (burner). Wait for redirect.]

> *"Two signatures. The first creates the trust object. The second wires up beneficiaries, the rule, the deposit — all in one programmable transaction block. Watch."*

### 1:50 → 2:25 — Trust page + AgentRecallCard + Seal docs

[Lands on /app/trust?id=...]

> *"Live data. Trust deployed. Active. Zero point zero two SUI balance."*

[Scroll down to Overview tab content — Trust Details, Beneficiaries, then Agent's Working Memory card]

> *"And here's the Walrus track in one widget."*

> *"Agent's Working Memory. Before its next cycle, this is what the AI trustee will recall from Walrus via MemWal. Right now it's empty — this trust is brand new — but every cycle from now on will write back here. Per-trust scoped. Seal-encrypted."*

[Click Documents tab]

> *"Now the Walrus storage layer. Real document upload."*

[Click Upload, choose ~/Desktop/will.txt. Status text streams.]

> *"Encrypting with Seal in my browser. Storing on Walrus. Recording the reference on-chain."*

[Document 1 appears with Walrus blob ID]

> *"Three different infrastructure layers, one upload. Now decrypt."*

[Click Decrypt. Sign personal message popup. File downloads.]

> *"Decrypt asks me to sign a session key, the Seal key server simulates the on-chain seal_approve to verify I'm authorized, only then it releases the decryption key. Byte-identical round trip."*

[Quickly open the downloaded will.txt to show plaintext if recording allows.]

### 2:25 → 2:50 — Beneficiary + activity + memory at scale

[Click **Self** in sidebar under Beneficiary]

> *"Switching roles. Same wallet, viewed as a beneficiary."*

> *"Soulbound NFT — non-transferable. Allocation, conditions, parent trust. And I can request a distribution on-chain — no phone call, no email."*

[Click Activity in sidebar]

> *"Activity feed. Filtered to My Trusts. Every event the contract emitted — each one links to its transaction on SuiVision."*

[Click Memory in sidebar]

> *"And Memory. This is the compounding part. As more trusts run more cycles, this page becomes the agent's institutional knowledge — encrypted on Walrus, scoped to my trusts only. Privacy by design."*

### 2:50 → 3:00 — Close

[Scroll to footer with Sui logo + Walrus Track badge]

> *"trustea. Built on Sui. Powered by Walrus, Seal, and MemWal."*

> *"This is what AI agents look like when they finally have memory that lasts. Thanks."*

[End recording.]

---

## Demo polish: things that should work without thinking

Before pressing record:

- [ ] Burner pre-connected (`localStorage` set, page reloaded once, Trustea Burner clicked)
- [ ] Deployer wallet has ≥ 0.1 SUI for any tx fallback
- [ ] `~/Desktop/will.txt` exists with one-liner content
- [ ] Groq proxy reachable (`curl http://147.45.240.145:9007/health` → has_groq:true)
- [ ] Pitch in explainer mode (press E once)
- [ ] Close all browser dev tools and notification overlays
- [ ] Bluetooth headphones disconnected (audio cuts mid-recording)
- [ ] Phone on Do Not Disturb
- [ ] Screen recording at 1920×1080, audio source = mic (not system)

## Recovery one-liners (memorize these)

| If it fails | Say |
|---|---|
| Groq slow >3s | *"Groq is propagating across regions — normally sub-second."* |
| Walrus upload slow | *"Walrus is replicating across storage nodes."* |
| Wallet sig hangs | [refresh page, burner reconnects] *"On testnet sometimes the wallet needs a nudge."* |
| Deploy fails | [skip, narrate previously created trust] *"For brevity I'll switch to a trust we created earlier — fully on-chain."* |
| Decrypt fails | *"Seal key server has a short cache — let me retry."* [retry once] |

## What NOT to say

- ❌ "I think it should work"
- ❌ "Hopefully this loads"
- ❌ "Bear with me"
- ❌ "Actually, let me show that again"
- ❌ "This is just a demo, in production..."

Each one is a confidence killer. If something breaks, narrate forward, don't apologize.

---

## Pitch deck adjustments before recording

If you have 5 minutes before the timer runs out:

1. Open pitch.html, press E for explainer mode
2. Walk through every slide once silently — make sure animations finish before reading
3. Note any text that wraps weirdly on your screen
4. Test the explainer order (0→1→2→4→5→8→9→11) by pressing → 7 times

---

## File locations

- This script: `~/Trustea/ideation/28-demo-voice-script.md`
- Pitch deck: `~/Trustea/pitch.html`
- Demo recording flow (longer ops doc): `~/Trustea/ideation/27-demo-recording-flow.md`
- Walrus URL: https://trustea.fawesome.dev
- Test contract on SuiVision: https://testnet.suivision.xyz/package/0xa3e912b4d4be96e1206bd76cdadb512fe151b9dfd6921bd9afc9be1d97a8487a

# Walrus Team Call — 15 Minute Prep

**DO NOT COMMIT THIS FILE**

---

## Goal

Pre-validate Trustea with the Walrus track representative. Leave the call with:
1. Confirmation that this is the right track
2. Technical feedback on our Walrus/Seal/MemWal usage
3. Their memory of us when they review submissions
4. Insight into what other teams are building

## The Empty Calendar Signal

Nobody is booking Walrus calls. This means:
- Most teams haven't started building for Walrus yet
- Or they don't think they need guidance
- Or they're not using Walrus deeply enough to have questions

We show up with a deployed backend, 56 passing tests, real MemWal memories, and a clear product vision. We'll be the most prepared team they talk to. That impression sticks.

---

## Call Structure (15 minutes, tight)

### Minute 0-1: Who We Are (60 sec)

> "I'm Nik, CTO and builder. My teammate Anna is a CS student at TU Graz handling design and frontend. We're building Trustea — on-chain trust fund infrastructure on Sui. We think this is a Walrus track project and wanted to validate that with you before we go deeper."

Don't oversell. State facts. Move fast.

### Minute 1-4: The Problem (3 min)

> "$35 trillion sits in trust funds globally. The administration — monitoring conditions, releasing funds, managing documents — is handled by human trustees who charge 1-2% of assets annually. That's $50,000+ per year on a $5M trust, for decades, for work that's fundamentally rule-based.
>
> We're replacing the administration layer with programmable smart contracts and an AI agent. The grantor writes rules in plain English. The AI translates them to on-chain logic. An agent monitors conditions, proposes distributions, manages yield. And here's where Walrus comes in — everything the agent does, every document the trust holds, is stored permanently and verifiably on Walrus."

### Minute 4-8: Live Demo (4 min — terminal, not slides)

Share screen. Terminal open. Run these in order:

**1. Integration test headline (30 sec)**
```bash
npx tsx scripts/integration-test.ts
```
> "56 integration tests against live testnet. Creates a trust, deposits SUI, mints a soulbound beneficiary NFT, adds rules, proposes a distribution, grantor vetoes it, pauses and resumes. All passing."

Skip to the end — show the 56/56 PASS line and the Suivision link.

**2. MemWal (60 sec) — THIS IS THE KEY MOMENT**
```bash
npx tsx scripts/test-memwal.ts
```
> "The AI agent stores every decision to MemWal. Condition checks, yield actions, compliance reviews. Here — 4 memories stored across 2 namespaces. Now watch the semantic recall."

Point at the distance scores. "Alice age condition" query returns the Alice memory at 0.39 distance, with yield and compliance ranked further away.

> "This is what makes the agent persistent. It doesn't start from scratch each session. It recalls what happened last time. Over years of trust administration, this memory compounds."

**3. Rule translator (60 sec)**
```bash
npx tsx scripts/test-rule-translator-local.ts
```
> "12 real trust fund rules — age-based, periodic, compound conditions, HEMS medical expenses, income matching, bankruptcy suspension, spendthrift caps. The AI parses all of them into structured on-chain parameters."

Scroll through a few results. Point at the compound rule ("graduate AND 21 AND no criminal record").

**4. Seal encryption (30 sec)**
```bash
npx tsx scripts/seal-test.ts
```
> "Trust documents are Seal-encrypted before going to Walrus. Only beneficiaries listed in the smart contract can decrypt. The policy is enforced by our Move contract's seal_approve function."

**5. Show the trust on Suivision (30 sec)**

Open the browser to the testnet explorer link. Show the Trust object with its fields — beneficiaries, rules, walrus_blob_ids, balance.

> "This is a live trust object on Sui testnet right now. Rules, balance, beneficiaries, Walrus blob references — all on-chain."

### Minute 8-10: Why Walrus Track (2 min)

> "We use all three Walrus primitives, and none of them are bolted on:
>
> **Walrus blobs** — trust documents. Agreements, amendments, identity proofs, RWA documentation. Encrypted via Seal, stored permanently. A trust runs for decades — the documents need to outlive any single server.
>
> **Seal** — three layers of access control. First: beneficiary-only document decryption. Second: time-locked encryption that unlocks on a specific date. Third — and this is the part I'm most excited about — the agent's memory is Seal-encrypted before it touches any server.
>
> **MemWal** — the AI agent's persistent memory. And here's the privacy story: we use MemWal Manual mode. The agent's decisions are Seal-encrypted before they touch any server. The permanent record on Walrus is ciphertext — only the delegate key holder can decrypt it. Traditional trusts? Lawyers, accountants, the trust company — they all see everything forever. Ours? The administration history is encrypted and private on Walrus. Verifiable that it exists, but only authorized parties can read the contents."

This is the privacy story that traditional trusts can't match.

Don't quote the track statement directly. Just demonstrate you read it.

### Minute 10-12: Architecture (2 min)

> "The legal model is a directed trust — recognized in 17+ US states. A licensed trust company handles the administrative role. Our AI agent and smart contracts serve as the direction advisors. The 48-hour override window maps to the trust protector role in the legal framework.
>
> We also just added the ability for the grantor to manually propose distributions. When a soulbound credential doesn't exist on-chain yet — say, a university diploma — the grantor verifies offline and proposes manually. The system degrades gracefully from fully automated to human-in-the-loop."

### Minute 12-14: Questions for Them (2 min)

These are the real reason for the call:

1. **"We're using MemWal Manual mode for fully client-side encryption — embeddings + Seal encrypt locally, only ciphertext goes to the relayer. Are there patterns or best practices we should follow for this?"**
   Shows depth. The relayer's manual endpoint has a known issue (HTTP 500 on upload-relay). Ask if this is being fixed or if there's a workaround.

2. **"For Seal time-locked encryption — is our key-id format correct?"**
   We concatenate the trust object ID + 8-byte BCS timestamp as the suffix. We followed the tle.move reference pattern. Is there a better approach?

3. **"We also built an RWA token module — soulbound tokens representing real-world assets held by the trust, with Walrus blob references to encrypted documentation. Does this align with how you see Walrus being used for real-world asset provenance?"**
   This shows we're thinking beyond the obvious.

4. **"What makes a Walrus track submission stand out to you?"**
   Direct question. They'll tell us what they're looking for.

5. **"Are you seeing other projects in the finance vertical?"**
   Intel on competition. They'll be diplomatic but might hint at the landscape.

### Minute 14-15: Close

> "Thank you — this was extremely helpful. We're heads-down on frontend this week with Anna. Anything we should be thinking about for the submission that we might be overlooking?"

Leave the door open for follow-up.

---

## What NOT to Say

- Don't mention other tracks ("we considered DeFi & Payments"). You're committed to Walrus.
- Don't say "hackathon project." Say "infrastructure" or "platform."
- Don't apologize for no frontend yet. The backend passing 56 tests is more impressive than a pretty UI with no substance.
- Don't name-drop competitors (Hedgey, Sablier). If they ask about competitive landscape, describe the gap, not the players.
- Don't ask "do you think we can win?" Ask "what would make this stronger?"
- Don't show slides. Show the terminal. Engineers respect working code over pitch decks.

## What TO Emphasize

- **Real integration, not a wrapper.** We don't just store one file on Walrus. We have encrypted documents, agent memory with semantic recall, on-chain blob references, and a Seal policy enforced by Move.
- **Long-running.** A trust fund is the ultimate long-running workflow. It runs for decades. The agent needs memory that persists across years. That's the MemWal thesis.
- **Three primitives, all genuine.** Walrus for documents. Seal for privacy. MemWal for agent memory. Each one has a real purpose.
- **56 passing tests.** This isn't a "we plan to build" conversation. This is "here's what's working on testnet right now."
- **Legal viability.** Directed trust framework. Human override. This isn't just crypto — it's real financial infrastructure.

---

## Pre-Call Checklist

- [ ] Terminal open with Trustea directory
- [ ] `sui client balance` shows funds
- [ ] Run integration test once to warm up (so it's fast on the call)
- [ ] Suivision link ready to open: https://testnet.suivision.xyz/object/[trust-id]
- [ ] MemWal test run once (memories already stored, recall is instant)
- [ ] Browser zoom at 125% for readability
- [ ] No notifications, clean desktop
- [ ] Have the 4 questions written down so you don't forget

---

## After the Call

1. Write down everything they said — exact words if possible
2. Note any technical suggestions
3. If they mentioned other projects or patterns, research them
4. If they suggested changes, implement same day and mention in submission
5. Send a brief thank-you message if there's a Telegram/Discord thread

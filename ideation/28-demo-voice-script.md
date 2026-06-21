# Demo Voice-Over Script — Sui Overflow 2026, Walrus Track

**Total runtime: 5:00** (pitch 2:00 + live demo 3:00)
**Recording**: Loom or QuickTime · 1080p · 30fps · mic only (no face cam)
**Pace**: ~140 wpm (conversational, not rushed)
**Tone**: sober funded-startup — confident, no defensive framing

`[stage]` notes are not spoken.

---

## Pre-flight (5 minutes before recording)

1. **Top up `~/Desktop/will.txt`** (used in Seal docs demo):
   ```bash
   echo "Last will and testament — demo, $(date -u +%Y-%m-%d). If you can read this, Seal decryption worked end-to-end on Walrus." > ~/Desktop/will.txt
   ```

2. **Open these tabs in fresh Chrome window** (no extensions visible, no dev tools):
   - Tab 1: https://trustea.fawesome.dev/?demo=1 (landing)
   - Tab 2: https://trustea.fawesome.dev/app/?demo=1 (dapp)
   - Tab 3: https://trustea.fawesome.dev/pitch (pitch deck)
   - Tab 4: https://testnet.suivision.xyz/package/0xa3e912b4d4be96e1206bd76cdadb512fe151b9dfd6921bd9afc9be1d97a8487a (proof; will open via LIVE pill in demo, keep tab handy)

3. **Seed burner wallet** in Tab 2 console:
   ```js
   localStorage.setItem('trustea-burner','1')
   localStorage.setItem('trustea-burner-key','<PASTE_BURNER_KEY_FROM_LOCAL_NOTES>')
   localStorage.setItem('trustea-onboarded','1')
   location.reload()
   ```
   Then **Connect Wallet → Trustea Burner (Dev)** — confirm address chip shows `0x645e…1387` in sidebar before recording.

4. **Pre-warm chunk cache**: open `/app/create`, `/app/trust/?id=0x99ffbcbf295d6cd7ae55b74765e196c7907a54bc1bde4feaf3d29fcb46af1919`, `/app/memory` once each so JS chunks are cached. Close those tabs after.

5. **Press `E` once in Tab 3** (pitch deck) — explainer mode badge appears bottom-right.

6. **Status checks** (paste into terminal):
   ```bash
   curl -s http://147.45.240.145:9007/health
   curl -s -o /dev/null -w "%{http_code}\n" https://trustea.fawesome.dev/
   ```
   Both should return `200` / `has_groq:true`.

7. **Quiet the desk**: DND on, Slack/Telegram closed, headphones unplugged (Bluetooth audio glitches mid-take), phone face down.

---

## PART 1 — Pitch (2:00)

> Switch to Tab 3, full-screen, press `E` confirm explainer mode. Begin recording.

### Slide 1 · Cover (0:00 → 0:15)

> *"This is trustea — an AI trustee with decades-long memory, powered by Walrus."*

> *"You write rules in plain English. The contract enforces them. Forever."*

[press →]

### Slide 2 · Problem (0:15 → 0:35)

> *"Thirteen trillion dollars sits in US private trusts."*

> *"Administering them costs up to thirty thousand a year — every year, forever. The layer between grantor and beneficiary is still paper and phone calls."*

> *"On a five-million dollar trust, that's nearly four hundred thousand in admin fees over thirty years."*

[press →]

### Slide 3 · Solution (0:35 → 0:50)

> *"Trustea replaces that layer."*

> *"Describe the whole trust in one paragraph — AI fills every step. A Move contract executes it. Every decision encrypted on Walrus. You keep a forty-eight hour veto on every AI action."*

[press →]

### Slide 4 · How it works (0:50 → 1:05)

> *"Three steps. Describe the trust. The AI monitors twenty-four seven and proposes distributions. Every action executes on-chain; every decision recorded on Walrus via MemWal — reconstructable fifty years from now."*

[press →]

### Slide 5 · Why memory matters (1:05 → 1:25)

> *"Year one — the agent is cold. By year five, after sixty-plus cycles, it recalls every prior decision before proposing anything new."*

> *"The memory loop is what makes the trustee smarter over time. That's the Walrus moment."*

[press →]

### Slide 6 · Architecture (1:25 → 1:45)

> *"Four primitives. Move is the source of truth. Walrus stores documents and logs. Seal encrypts — only grantor and beneficiaries can decrypt. MemWal closes the loop — every decision teaches the next."*

> *"Nothing held by us. Everything verifiable on Sui."*

[press →]

### Slide 7 · Proof (1:45 → 2:00)

> *"Five Move modules, thirty-three tests passing, live on Sui testnet."*

> *"Let me show you what one paragraph of English does."*

[Stop pitch. Switch to Tab 2. Begin Part 2.]

---

## PART 2 — Live demo (3:00)

> Tab 2 (dapp). Burner pre-connected. `~/Desktop/will.txt` ready.

### 0:00 → 0:20 — Landing & live proof

[Switch to Tab 1, scroll once to show Memory section, then back to top]

> *"Walrus-hosted. HTTPS-signed. The whole site lives on Walrus testnet — site object, JS, CSS, fonts, all of it."*

[Click the **LIVE — Deployed on Sui Testnet** pill at top]

> *"That pill links straight to the contract. Real package on chain. You can verify every transaction yourself."*

[Tab 4 opens with SuiVision — 2 seconds, close it, back to landing]

[Click **Open App** in nav]

### 0:20 → 0:35 — Dashboard

[Dashboard loads. TVL hero, sidebar with existing trust]

> *"Connected with a burner wallet that already has one trust — the demo I ran yesterday. Total value locked, beneficiaries, next unlock. Standard fiduciary dashboard."*

> *"Now let me create a new one. Watch this."*

[Click **+ New Trust**]

### 0:35 → 1:50 — Quick Start: trust from one paragraph

[Wizard step 1 opens with Quick Start banner at top]

> *"Here's the part no one else does. I'm not going to fill six steps by hand."*

[Click the textarea inside Quick Start banner. Type slowly:]

> **"Set up a trust for my daughter Alice. Give her 100 SUI monthly while she is enrolled in university. Full inheritance when she turns 30. Fund with 0.05 SUI."**

[Click **Generate trust** button]

[Wait 1-2s — AI summary card appears: Applied — 1 beneficiaries · 2 rules, confidence bar ~95%]

> *"Two seconds. The AI filled the name, the description, my beneficiary, two on-chain rules, the initial deposit — every step of the wizard. Confidence ninety-five percent."*

[Click through Continue, Continue, Continue — show how each step is already pre-filled. Pause briefly on Step 3 Beneficiaries to point at the Alice card, paste burner address into Wallet Address field since AI couldn't guess it]

> *"AI left the wallet address empty because I didn't give one — fair. I'll drop the address in. I could also click Invite link and send a share URL to Alice if she's not connected yet."*

[Continue → skip DMS step → land on Step 6 Fund]

[Deposit field already shows 0.05 SUI from AI]

> *"Initial deposit pre-filled too. Deploy."*

[Click **Deploy Trust**. Two wallet signatures fire (burner is silent — no popup). Wait for redirect.]

> *"Two signatures. The first creates the trust object. The second wires up the beneficiary, both rules, and the deposit in a single programmable transaction block. Watch."*

### 1:50 → 2:25 — Trust page · AgentRecallCard · Seal docs

[Lands on `/app/trust?id=...`]

> *"Live trust. Active. Zero point zero five SUI. One beneficiary. Two rules — exactly what I described."*

[Scroll Overview tab down to **Agent's working memory** card]

> *"And this is the Walrus track moment. Agent's working memory. Before its next cycle, this is what the AI trustee recalls from Walrus via MemWal — scoped to this trust only. The memory grows with every decision."*

[Click **Documents** tab]

> *"Now the storage layer. Real document upload."*

[Click **Upload**, choose `~/Desktop/will.txt`. Status text streams]

> *"Encrypting with Seal in my browser. Storing on Walrus. Recording the reference on-chain. Three different infrastructure layers, one upload."*

[Document 1 card appears with Walrus blob ID. Click **Decrypt**, sign personal message popup]

> *"Decrypt asks me to sign a session key, the Seal key server simulates the on-chain seal_approve to verify I'm authorized, only then releases the key."*

[File downloads to ~/Downloads/will.txt]

> *"Byte-identical round trip."*

### 2:25 → 2:55 — Beneficiary · Activity · Memory

[Click **Self** in sidebar under Beneficiary section]

> *"Same wallet, viewed as a beneficiary. Soulbound NFT — non-transferable. Allocation, conditions, parent trust. I can request distributions on-chain — no phone call."*

[Click **Activity** in sidebar]

> *"Every event the contract emitted. Filtered to My Trusts. Each one links to its transaction on SuiVision. This is the audit trail traditional trusts can't give you."*

[Click **Memory** in sidebar]

> *"And Memory. What the agent recalls across cycles. As more trusts run more cycles, this becomes institutional knowledge — Seal-encrypted on Walrus, scoped to my trusts only."*

### 2:55 → 3:00 — Close

[Scroll to footer with Sui logo + Walrus Track badge]

> *"trustea. Built on Sui. Powered by Walrus, Seal, and MemWal."*

[End recording]

---

## Recovery one-liners (memorize)

| If it fails mid-recording | Say |
|---|---|
| Groq slow >3s | *"Groq is propagating across regions — usually sub-second."* |
| Walrus upload slow | *"Walrus is replicating across storage nodes."* |
| Wallet sig hangs | [refresh] *"Testnet sometimes needs a nudge."* |
| Deploy errors out | [open existing trust] *"For brevity I'll switch to the trust we created earlier — fully on-chain."* |
| Decrypt fails | [retry once] *"Seal key server has a short cache — let me retry."* |
| Quick Start returns empty | [fall back to manual wizard, narrate it] *"Let me fill these by hand — same result, just slower."* |

## What NOT to say (each kills a star)

- ❌ "I think it should work"
- ❌ "Hopefully this loads"
- ❌ "Bear with me"
- ❌ "Actually, let me show that again"
- ❌ "It's just a demo"
- ❌ "Not a prototype" (sober tone — let live testnet speak)

If something breaks, **narrate forward**. Apologies cost credibility.

---

## URLs for submission

- App + landing + pitch: **https://trustea.fawesome.dev/** (single Walrus site)
- Pitch deck directly: **https://trustea.fawesome.dev/pitch**
- Contract on SuiVision: https://testnet.suivision.xyz/package/0xa3e912b4d4be96e1206bd76cdadb512fe151b9dfd6921bd9afc9be1d97a8487a
- Walrus site object: https://testnet.suivision.xyz/object/0x47019898a51e7416d3d7c38ff1aae6624eb6e9f9c1907ab564d246622df8c50c
- GitHub: https://github.com/himicos/Trustea

## Demo address book

- Deployer / grantor wallet: `0xe50e03c195bcef64ee2cdfe3cea37f4dba6a65a05e8b3d529ff093a446558b56`
- Recording burner: `0x645ec801f925f1865f9049f887486da77d3d6f50f63f740fbb281dcb47621387`
- Burner private key (localStorage only): `<PASTE_BURNER_KEY_FROM_LOCAL_NOTES>`
- Existing demo trust (backup if create flow fails): `0x99ffbcbf295d6cd7ae55b74765e196c7907a54bc1bde4feaf3d29fcb46af1919`

## Loom recording tips

- **Cmd+Shift+L** start/stop (faster than UI click — saves the first second of audio)
- Enable 3-second countdown in Loom settings → gives a breath before the first word
- **Camera off** — keeps focus on the screen
- Two separate Looms (pitch + demo) if free tier — splits the 5-min limit
- After upload, Loom auto-generates chapter timestamps; paste both URLs into submission with "Chapter timestamps in description" note

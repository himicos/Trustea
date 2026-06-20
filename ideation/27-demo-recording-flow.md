# Demo Recording Flow — Sui Overflow 2026

**Recording target:** 5 minutes total
**Format:** Voice-over + screen capture
**Tool:** QuickTime / OBS · 1920×1080 · 30fps
**Cursor:** highlight enabled (Mouseposé or similar)

---

## Setup before recording

1. **Browser tabs in order** (Chrome/Brave clean profile, no extensions visible):
   - Tab 1: `https://trustea.fawesome.dev/` (landing)
   - Tab 2: `https://trustea.fawesome.dev/app/` (dapp — burner already seeded)
   - Tab 3: `~/Trustea/pitch.html` (open with `file://`)
   - Tab 4: `https://testnet.suivision.xyz/package/0xa3e912b4d4be96e1206bd76cdadb512fe151b9dfd6921bd9afc9be1d97a8487a` (proof)

2. **Burner wallet primed**:
   ```js
   localStorage.setItem('trustea-burner','1')
   localStorage.setItem('trustea-burner-key','suiprivkey1qptsfafs9a77lwcv5zrafakzez2ucjea6syhc8kt8hwcq9z4r9pny4960kw')
   localStorage.setItem('trustea-onboarded','1')
   location.reload()
   ```
   Then click Connect Wallet → Trustea Burner (Dev).

3. **Fresh test document for Seal demo**:
   ```bash
   echo "Last will and testament — Walrus Live Demo, $(date -u +%Y-%m-%d). When decrypted, this proves end-to-end privacy works on Walrus." > ~/Desktop/will.txt
   ```

4. **Pitch in explainer mode**: open pitch.html → press `E` once. Mode indicator appears bottom-right.

5. **Pre-flight checks**:
   - [ ] Burner has ≥ 0.05 SUI (`curl …getBalance…` returns mist)
   - [ ] Proxy health: `curl http://147.45.240.145:9007/health` → `"has_groq":true`
   - [ ] Walrus site loads → all 4 stat cards render
   - [ ] DNS for trustea.fawesome.dev resolves

---

## Recording 1 — Pitch explainer (2 minutes)

> **Use `pitch.html` in explainer mode. Speak conversationally — no script-reading energy.**

### Slide 1 — Cover (0:00 → 0:10)

**Visual:** big "trustea" logo + tagline "Write rules in plain English. AI enforces them."

**Say:**
> *"Trustea — on-chain trust fund infrastructure on Sui. We replace the $30k-a-year administration layer that hasn't changed in decades with smart contracts and an AI trustee."*

### Slide 2 — Problem (0:10 → 0:35)

**Visual:** "$13 trillion sits in US private trusts. Managed by paper, phone calls, lawyers."

**Say:**
> *"Thirteen trillion dollars sits in US private trusts today. Administering them costs fifteen to thirty thousand a year on a one-million dollar trust. That's one to two percent of assets, every year, forever. Why? Because the layer between the grantor and the beneficiary is still paper, phone calls, and lawyer interpretation."*

> *"On a five-million dollar trust over thirty years, that's three hundred ninety thousand dollars in admin fees."*

### Slide 3 — Solution (0:35 → 1:00)

**Visual:** "Trustea replaces the administration layer with AI + smart contracts."

**Say:**
> *"Trustea replaces that layer. The grantor writes rules in plain English. An AI translator turns compound conditions into on-chain logic. A Sui Move contract holds the assets and executes distributions. Every decision is Seal-encrypted, stored on Walrus, and a human keeps a forty-eight hour veto on every AI action."*

### Slide 4 — How it works (1:00 → 1:20)

**Visual:** 3 steps + live audit log on right.

**Say:**
> *"Three steps. Write the rule, AI translates, the trust deploys. The agent monitors twenty-four seven, proposes distributions, you veto if needed. Every action is encrypted on Walrus — reconstructable fifty years from now."*

### Slide 5 — Architecture tree (1:20 → 1:40)

**Visual:** the architecture tree — root grantor → AI translator → Move contract → 3 leaves (Walrus / Seal / MemWal).

**Say:**
> *"Four primitives. The Move contract is the source of truth. Walrus stores documents and audit logs permanently. Seal handles identity-based encryption — only grantor and beneficiaries can decrypt. MemWal gives the agent persistent memory across decades. Nothing is held by us. Every layer is verifiable on Sui."*

### Slide 6 — Proof (1:40 → 1:55)

**Visual:** "Fully deployed. Not a prototype." — 6 modules / 33 tests / 56 integration / 22 builders / 12 patterns.

**Say:**
> *"Not a prototype. Six Move modules, thirty-three tests passing, fifty-six integration tests, full TypeScript SDK. Deployed on Sui Testnet — you can click the package ID and verify every transaction yourself."*

### Slide 7 — CTA (1:55 → 2:00)

**Visual:** "trustea. Your legacy deserves infrastructure that lasts." + github link.

**Say:**
> *"This is trustea. Now let me show you what it actually does."*

---

## Recording 2 — Live demo (3 minutes)

> **Switch to Tab 2 (`/app/`). Burner already connected. Voice-over while clicking.**

### 0:00 → 0:20 — Landing & live proof

1. Switch to Tab 1, scroll once
2. Click the green **"LIVE — Deployed on Sui Testnet"** pill at top
3. Tab 4 opens with SuiVision contract page

**Say:**
> *"This is the landing — Walrus-hosted, HTTPS-signed, live. The LIVE pill links straight to the contract on Sui testnet. You're not seeing a mockup — you're looking at the deployed package."*

### 0:20 → 0:35 — Open the app

1. Switch back to landing, click **Open App** in top-right
2. Land on dashboard — TVL hero card, sidebar with existing trust

**Say:**
> *"Open the app. I'm connected with a wallet that already has one trust — you can see total value locked, my trust under 'Your Trusts', and 'Self' under Beneficiary."*

### 0:35 → 1:30 — Create a new trust (the hero flow)

1. Click **+ New Trust**
2. **Step 1 Basics**: name = "Demo Trust", description = "AI-managed", Continue
3. **Step 2 Roles**: skip (defaults), Continue
4. **Step 3 Beneficiaries**: Add Beneficiary → name "Alice", address (paste burner addr), 0.1 SUI allocation
5. **Step 4 Rules**: type slowly:
   > **"Release 100 SUI to Alice every month while she is enrolled in university"**
6. Press Enter or the sparkle button. **WAIT** for Groq response (~1-2s).
7. Card appears: `ruleType: periodic`, `100 SUI`, confidence bar ~90%, nftType `university_enrollment`
8. Continue → Continue (skip DMS) → Step 6 Fund: deposit `0.02 SUI` → **Deploy Trust**
9. **Two wallet signatures** auto-fire (burner). Wait for redirect.

**Say:**
> *"The hero feature. I write a rule in plain English. Notice — I'm not picking from a dropdown, I'm not coding."* (paste rule)
> *"The AI translator runs against Groq's Llama 70B and returns structured on-chain logic in about a second. It identified this as a periodic rule, monthly cadence, conditioned on a university enrollment credential. Confidence bar shows ninety percent — if it were lower, I'd see a warning."*
> *(Click Continue, skip safety, set 0.02 SUI deposit, click Deploy.)*
> *"Two signatures. The first creates the trust, the second wires up beneficiaries, the rule, and the deposit in a single PTB. Watch."*

### 1:30 → 2:15 — Trust page + Seal documents

1. Lands on `/app/trust?id=...` — hero card showing the new trust live
2. Point at: SUI Balance, Beneficiaries, Rules
3. Click **Documents** tab
4. Click **Upload**, choose `~/Desktop/will.txt`
5. Status text streams: "Encrypting with Seal..." → "Storing on Walrus..." → "Recording reference on-chain..."
6. Document 1 appears with Walrus blob ID
7. Click **Decrypt**. Browser saves `will.txt` to Downloads. Open it to show plaintext.

**Say:**
> *"We're now on the trust page. Live data — zero point zero two SUI balance, one beneficiary, one document slot ready."*
> *"Now the Walrus track moment. I'm uploading a real document — could be a will, could be a portfolio statement. Watch the status."*
> *(point at status text)*
> *"Seal encrypts it in my browser — identity-based, scoped to this trust. Walrus stores the encrypted blob. The trust contract records the reference on-chain. Three different infra layers, one upload."*
> *(click Decrypt)*
> *"Decrypt asks me to sign a session message, then asks the Seal key server — which simulates the on-chain seal_approve to verify I'm authorized — and only then releases the key. Byte-identical round trip."*

### 2:15 → 2:45 — Beneficiary side + activity

1. Click **Self** in sidebar (Beneficiary section)
2. Beneficiary NFT page: Soulbound badge, allocation, conditions, parent trust
3. Scroll to "Request a Distribution", fill amount 0.01 SUI + reason "tuition", **Submit Request**
4. Wallet sig fires, "Request submitted" appears
5. Click **Activity** in sidebar
6. Filter `My Trusts` — feed shows Distribution Requested, Document Stored, Deposit, NFT Minted, Trust Created

**Say:**
> *"Switching role. I'm now looking at this same wallet as a beneficiary. The NFT is soulbound, non-transferable. I can request a distribution on-chain — no phone call, no email."*
> *(submit request)*
> *"Sent. Now Activity. Filtered to 'My Trusts' — every event the contract has emitted: trust created, NFT minted, document stored, deposit, distribution request. Each one links to its transaction on SuiVision. This is the audit trail traditional trusts can't give you."*

### 2:45 → 3:00 — Closing

1. Click **Memory** in sidebar — shows agent memory page (live recall if any agent cycles ran for this trust, demo preview otherwise)
2. Click footer Sui logo / **Sui Overflow 2026** badge

**Say:**
> *"And Memory — what the AI trustee remembers across cycles, encrypted on Walrus via MemWal, scoped to my trusts only. Decisions that compound over decades."*
> *"Trustea — built on Sui for Sui Overflow 2026, Walrus track. Thanks."*

---

## Editing checklist (post-record)

- [ ] Cut dead air between sections
- [ ] Trim wallet popup delays (jump-cut the moment the modal appears to the moment it closes)
- [ ] Highlight cursor on key clicks: Open App, Deploy Trust, Upload, Decrypt
- [ ] Lower-third caption with current section name (Problem / Solution / Demo)
- [ ] First 3 seconds: muted intro of pitch slide before voice starts
- [ ] Last 5 seconds: hold the cover slide with URL visible
- [ ] Loudness normalize to -16 LUFS
- [ ] Export H.264, 1080p, 30fps, target file < 200MB

---

## If something breaks during recording

- **Wallet sig dialog stuck**: refresh page, burner reconnects automatically.
- **Groq slow** (>5s): wait through it — say *"the agent is calling out to Groq for rule translation, normally under a second"*. Don't cut.
- **Walrus upload slow**: same — *"Walrus is propagating across storage nodes."*
- **Deploy fails with "insufficient gas"**: burner ran out, top up from deployer wallet via `sui client transfer-sui`.
- **Portal returns 404 on any route**: SSH `root@147.45.240.145` → `docker restart trustea-portal`.

---

## Backup URLs (read into mic if asked)

- App: https://trustea.fawesome.dev/app/
- Contract on SuiVision: https://testnet.suivision.xyz/package/0xa3e912b4d4be96e1206bd76cdadb512fe151b9dfd6921bd9afc9be1d97a8487a
- GitHub: https://github.com/himicos/Trustea
- Walrus site object: https://testnet.suivision.xyz/object/0x47019898a51e7416d3d7c38ff1aae6624eb6e9f9c1907ab564d246622df8c50c

---

## Demo address book

- Deployer: `0xe50e03c195bcef64ee2cdfe3cea37f4dba6a65a05e8b3d529ff093a446558b56`
- Recording burner: `0x645ec801f925f1865f9049f887486da77d3d6f50f63f740fbb281dcb47621387`
- Test trust (existing data for backup): `0x99ffbcbf295d6cd7ae55b74765e196c7907a54bc1bde4feaf3d29fcb46af1919`

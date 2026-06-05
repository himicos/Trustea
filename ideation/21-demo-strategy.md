# Demo Strategy — What to Show and How

## Demo Format: Two Parts

### Part 1: Film (0:00–1:15) — The Hook
Shot on location. Faces, walking, energy. This part sells the *why*.

### Part 2: Live Demo (1:15–4:30) — The Proof
Screen recording from MacBook. This part sells the *how*.

The transition between them is the most important cut in the video.

---

## Part 1: Film — Revised

Keep the original 10-demo-video.md structure but tighter. Key changes:

**Cut the fat.** The original script has too many talking points. The film part should do ONE thing: make the viewer feel that this is a real problem affecting real money, and that nobody has fixed it.

**Shot list (1 minute, not a second more):**

[0:00–0:08] — Visual energy. City. Movement. Scale. No voice.

[0:08–0:25] — Nik walking, fast delivery:
> "$35 trillion in trust funds. Rules. Conditions. Gatekeepers. The people enforcing these rules charge 1-2% of everything, every year, for decades — for doing what a program can do in milliseconds."

[0:25–0:35] — Anna, meeting Nik:
> "Smart contracts. AI agents. Verifiable storage. The technology to automate this exists. It just hasn't been built for trust funds. Until now."

[0:35–0:45] — Both face camera:
> Nik: "Trustea."
> Anna: "Pronounced like trustee — because that's what it replaces."

[0:45–1:00] — Fast alternating:
> "You write rules in English."
> "AI translates them to smart contracts."
> "An agent monitors conditions, proposes distributions."
> "Everything stored on Walrus. Private via Seal. Memory via MemWal."
> "No lawyers. No 2% fees. A trust that runs itself."

[1:00–1:15] — Transition. Cut to MacBook screen. Nik's hands on keyboard.
> "Let us show you."

**Total film: 75 seconds. Dense. Every sentence carries weight.**

---

## Part 2: Live Demo — The Compression Problem

We have 3 minutes and 15 seconds of screen time. We need to show:
1. Create a trust (with AI rule translation — the hero moment)
2. Fund it + add beneficiaries
3. Beneficiary gets soulbound NFT
4. Upload encrypted document to Walrus
5. Agent monitors conditions
6. Agent proposes distribution
7. Grantor veto window
8. Beneficiary decrypts document via Seal
9. Agent memory on MemWal

That's 9 features in ~200 seconds. 22 seconds per feature average. Impossible if we click through UI slowly.

### Solution: Pre-populated state + surgical demos

Don't create everything from scratch on camera. **Pre-populate** a trust with 3 beneficiaries, 3 rules, funds, and documents. Then demo specific moments:

**Demo Flow (3:15):**

**[1:15–1:50] Create Trust + AI Rules (35 sec) — THE HERO MOMENT**
- Dashboard is already open. Click "Create Trust."
- Type: "Release $50,000 to Alice when she turns 25"
- AI translation appears live — type, confidence bar, parsed condition
- Add two more rules fast (already typed, paste in)
- Show the 3 rules with their AI translations
- This is the part that makes jaws drop. Spend time here.

**[1:50–2:10] Deploy + Beneficiaries (20 sec)**
- Click through Step 3 (beneficiaries already filled), Step 4 (deposit amount), Step 5 (review)
- Click "Deploy to Sui"
- Show: transaction confirmation toast
- Quick: Beneficiary wallet shows the soulbound NFT
- Voiceover explains while UI moves fast

**[2:10–2:35] Agent Dashboard (25 sec)**
- Switch to the trust detail view, Agent tab
- Show the activity timeline: condition checks, yield actions, compliance reviews
- Show MemWal memory entries with timestamps
- Voiceover: "Every decision the agent makes is stored permanently on Walrus. Verifiable. Auditable. Even 50 years from now."

**[2:35–2:55] Distribution Proposal + Veto (20 sec)**
- Show a pending distribution in the dashboard
- "The agent detected that Carol's annual distribution is due. It proposed a release."
- Show the 48-hour countdown timer
- Click "Cancel" — demonstrate the grantor override
- "The human stays in control. Always."

**[2:55–3:15] Seal Decrypt (20 sec)**
- Switch to beneficiary view (different wallet)
- Click "Decrypt" on a trust document
- Wallet signature popup → document reveals
- "Only Alice can see this. The Seal policy is enforced on-chain by the smart contract."

**[3:15–3:35] MemWal Deep Dive (20 sec)**
- Back to grantor view. Agent tab → Memory browser
- Type a query: "What did the agent do about Alice?"
- Show semantic recall results with distances
- "The agent remembers. Across sessions, across months. It builds context over time."

**[3:35–3:55] Encrypted Memory (20 sec) — NEW KILLER MOMENT**
- Show the privacy architecture (text overlay or diagram):
- "Here's what makes this different from every other trust platform:"
- "Every decision the agent makes — every condition check, every distribution proposal, every yield action — is Seal-encrypted via MemWal before it's stored on Walrus."
- "The permanent record of your trust's administration is private. Only authorized parties with the delegate key can read it."
- "Traditional trusts? Lawyers, accountants, trust companies — they all have permanent access to everything. Ours? Ciphertext on Walrus. Verifiable that it exists, but private by default."
- This is the second jaw-drop moment after the AI translation.

**[3:55–4:05] Quick Architecture Flash (10 sec)**
- Show the architecture diagram (full screen, 3 seconds)
- "Sui for rules. Walrus for documents. Seal for privacy. MemWal for encrypted agent memory. Local inference for zero exposure."

---

## Part 2.5: The Close (4:00–4:30)

Back to film. Golden hour shots. Slower pace.

Anna:
> "Trust funds are a $35 trillion market built on paper and human gatekeepers. We're replacing the administration layer with verifiable, programmable infrastructure."

Nik:
> "Cheaper. Transparent. Permanent. And the AI trustee remembers everything."

Both:
> "Trustea."

Screen: URL, logo. Done. 4:30 total.

---

## Demo Execution Checklist

### Pre-demo setup (night before):
- [ ] Fresh trust created with test data (clean names, round numbers)
- [ ] 3 beneficiaries added with meaningful rules
- [ ] Trust funded with visible SUI amount
- [ ] 2-3 documents uploaded to Walrus and linked
- [ ] Agent has run 5-10 cycles (activity feed populated)
- [ ] MemWal has 10+ memories (semantic recall works well)
- [ ] One pending distribution exists (for veto demo)
- [ ] Beneficiary wallet has the NFT visible
- [ ] Browser zoomed to 125% (readable on video)
- [ ] Dark mode OFF, clean desktop, no notifications
- [ ] Wallet extension pinned, ready for signing

### During recording:
- [ ] Large cursor, deliberate clicks
- [ ] No hesitation. Know exactly where to click before recording.
- [ ] Type the AI rule slowly (audiences need to read it)
- [ ] Let the AI translation animate in (the wow moment)
- [ ] Don't explain what's obvious on screen — explain what's NOT visible (why it matters, what's happening under the hood)

### Mistakes to avoid:
- Don't start with "Hi, we're team X and we built Y" — the film part already introduced everything
- Don't read text that's on screen — the viewer can read
- Don't apologize for anything ("this is just a prototype")
- Don't show empty states or loading errors
- Don't explain Sui/Walrus/Seal to the audience — assume they know. Show them something they haven't seen before.

---

## The Single Line That Wins

If a judge remembers one thing from the demo, it should be this:

**Someone typed English. A smart contract appeared. An AI agent started monitoring it. And everything was stored permanently on Walrus.**

That's the moment. Everything else supports it.

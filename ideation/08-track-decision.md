# Track Decision: Walrus ✅ LOCKED

## Decision: Walrus Track — Final

---

## Why Walrus is the Optimal Track for Trustea

### 1. The Product IS Walrus's Thesis

The Walrus track problem statement says:
> "Push toward a future where AI agents are not just reactive tools, but persistent, collaborative systems powered by a reliable data layer."

A family trust fund is the **ultimate persistence problem**:
- Trusts run for **50-100+ years** across generations
- They need a data layer that outlasts any single company, server, or app
- Every amendment, distribution, and decision must be **verifiable** decades later
- Family financial data must be **private** (Seal)
- The AI trustee agent must **remember** across years of administration (MemWal)

No other hackathon project will have a better answer to "why does persistent, verifiable data matter?" than Trustea. A trading bot needs memory for hours. A research agent for days. **A family trust needs memory for a lifetime.**

### 2. Every Walrus Primitive Has a Clear Purpose

| Walrus Primitive | Trustea Use Case | Why It's Not Superficial |
|-----------------|-----------------|-------------------------|
| **Walrus Storage** | Trust documents, legal terms, amendments, audit trail | Trust docs must persist verifiably for decades — can't use AWS S3 |
| **MemWal (Walrus Memory)** | AI agent's long-term memory: decision history, compliance checks, beneficiary interactions | The agent administers a trust over YEARS — needs memory that persists across sessions, models, even framework changes |
| **Seal (Privacy)** | Encrypt trust details — only grantor, beneficiaries, and authorized parties can view | Family financial data is deeply sensitive — privacy isn't optional, it's a legal requirement |
| **Walrus Sites** | Host the Trustea frontend on decentralized infra | The trust UI itself should be as persistent as the trust data |

This is the difference between "uses Walrus because the track requires it" and "uses Walrus because the product genuinely needs it." Judges will feel that.

### 3. The Math Favors Walrus

| Factor | Walrus | Agentic Web |
|--------|--------|-------------|
| 1st Prize | **$35,000** | $30,000 |
| Total Pool | **$70,000** + $7,500 honorable | $62,500 |
| Historical Competition | **Lowest** (fewest entries as "Programmable Storage" in 2025) | High (AI = 2nd most popular 2025) |
| Scope | **Wide open** — any domain | 3 rigid sub-tracks with hard requirements |
| Sponsor Alignment | **Headline Partner** — Walrus team actively wants winners | Core track, no specific sponsor push |
| Office Hours | **Abner (Walrus)** available for idea validation | General Sui team only |

### 4. Trustea Doesn't Fit Agentic Web

Agentic Web has 3 sub-tracks with **hard requirements**:
- **Risk Guardian**: needs live price feeds, AI risk score, autonomous on-chain action, DAO override
- **Agent Wallet**: needs real Deepbook orders, self-enforced budget ceiling, owner revocation
- **Intent Engine**: needs text→PTB→execution, guardian catching 2+ risk classes

Trustea is none of these. We'd be forcing a trust fund product into a DeFi agent box. And the track explicitly warns: "Generic LLM wrappers that happen to hold SUI will not place."

In Walrus, Trustea is a **natural fit**. In Agentic Web, it's a **stretch**.

### 5. Past Walrus/Storage Winners — Achievable Quality Bar

2025 Programmable Storage winners:
- **SuiSign** (1st, $30k) — decentralized document signing. Clean product, clear use case.
- **WalGraph** (2nd) — graph database on Walrus. Technical but niche.
- **SuiMail** (3rd) — decentralized email with spam prevention.
- **Walpress** (4th) — website builder on Walrus.

These are solid but not insane. Trustea's ambition (trust fund infrastructure + AI agent + DeFi management + privacy) significantly exceeds this bar while remaining achievable in 17 days with Claude doing the heavy lifting.

### 6. The Pitch Writes Itself

> "Every year, American families pay billions in trustee fees for work that boils down to: check a condition, release funds. Trustea automates this entirely. Rules are programmable. Documents are stored on Walrus — verifiable, persistent, private. An AI agent monitors conditions and manages funds across decades. The trust outlives any company. That's what Walrus was built for."

This hits Real-World Application (50%) hard. Judges are Americans who understand trusts. It clicks instantly.

### 7. University Award Stacks On Top

With Anna on the team (CS student, ≥50% student threshold met), we're eligible for the University Award ($2,500) on top of the track prize. Max potential: **$35,000 + $2,500 = $37,500** for 1st place + University.

---

## Why NOT Walrus (Devil's Advocate)

- If Walrus APIs are limited or buggy on testnet → integration pain
- If many teams also target Walrus this year (prize pool doubled, may attract more)
- If judges for Walrus track are more technical and less impressed by product narrative

**Mitigations**: Research Walrus docs thoroughly (doing now), build on mainnet-ready features, make the technical depth match the product story.

---

## How to Position for Maximum Score

| Criterion (Weight) | How Trustea Scores | Target |
|--------------------|-------------------|--------|
| **Real-World Application (50%)** | $35T trust market. Every American family with wealth uses trusts. Fees are 1-2% AUM. Clear monetization path (0.1-0.3% AUM). | 9/10 |
| **Product & UX (20%)** | Polished dashboard: create trust in plain English, add beneficiaries, see AI agent activity, family-friendly UI. Anna leads design. | 8/10 |
| **Technical Implementation (20%)** | Deep Walrus/MemWal/Seal integration, Move smart contracts, AI agent with persistent memory, soulbound NFT verification. Every primitive earns its place. | 8/10 |
| **Presentation & Vision (10%)** | Startup-pitch video: problem→family story→demo→vision. Soulbound credential future. Multi-generational infrastructure. "Why didn't anyone do this before?" | 9/10 |

---

## Walrus API Mapping → See `11-walrus-technical-reference.md`

Full technical reference with all APIs, SDKs, code examples, and Trustea-specific architecture.

### Summary: What We'll Use

| Walrus Primitive | Trustea Feature | SDK |
|-----------------|----------------|-----|
| **Walrus Blobs** | Store trust documents, amendments, audit trail | `@mysten/walrus` (writeBlob, readBlob) |
| **Seal Encryption** | Encrypt all trust data, policy-based access control | `@mysten/seal` (encrypt, decrypt with Move policies) |
| **MemWal** | AI agent persistent memory across years of trust admin | `@mysten-incubation/oc-memwal` (remember, recall) |
| **Walrus Sites** | Host Trustea frontend on decentralized infra | `site-builder` CLI |
| **Auto-renewal** | Sui Move contract funded with WAL for perpetual document storage | Custom Move module |

### Key Architecture Decision
Encrypt-then-store pattern:
1. AES-256 encrypt trust document
2. Seal encrypt the AES key (with Move policy: beneficiary + time + multisig)
3. Store ciphertext on Walrus (`deletable: false`)
4. Store blobId + Seal key ref in Sui Trust object

This means: documents persist on Walrus forever, but only authorized parties (as defined by the Move contract) can decrypt them. The trust contract on Sui controls WHO can see WHAT and WHEN.

# Work Context Snapshot — June 12, 2026

State of the build after the June 10–11 frontend overhaul + e2e verification sessions.
For: Nik, Anna, and any agent picking this up. Deadline: **June 21**.

## Current state — what works (all verified end-to-end on testnet)

- **Package**: `0xa3e912b4d4be96e1206bd76cdadb512fe151b9dfd6921bd9afc9be1d97a8487a` (redeployed June 11; 33/33 Move tests green). The old `0xe2fb...5804` package LACKED `configure_dms` — e2e testing caught this. Old Published.toml backed up at `/tmp/Published.toml.bak`.
- **E2E-verified flows** (headless browser + dev burner wallet, real transactions):
  - Onboarding (4 slides) → 6-step create wizard → 2-tx deploy (create_trust, then add_beneficiary + add_rule + configure_dms + deposit in one PTB). Test trust: `0x48808a85aed4d7ca9a9bd9505f1c7a2aab8a9dfcd220d64b81eb400ca3c9b27e`
  - Deposit (multi-asset capable: SUI via gas split, any coin via deposit_coin<T> with coin picker)
  - DMS heartbeat (timer reset + on-chain event)
  - Beneficiary soulbound NFT page + on-chain distribution request
  - **Seal documents: byte-identical round trip** — browser Seal encrypt → Walrus blob → add_walrus_ref → seal_approve policy gate (grantor/beneficiary whitelist) → decrypt → download
  - Rule translation with local model (ollama gemma3:27b, ~70s cold / ~20s warm); freeform type names normalized via `ruleTypeNum()`
- **Live data pages**: Agent Activity (chain events, My Trusts/All filter), Agent Memory (real MemWal recall via `/api/memories`; agent memories live in namespace `trustea:agent-test`). Both fall back to labeled "Demo preview".

## Frontend architecture notes

- Next.js 16.2.7 — **breaking changes vs. training data**; read `frontend/node_modules/next/dist/docs/` before nontrivial changes (per frontend/AGENTS.md).
- Design: full dark theme (green-tinted near-black, Bitlend-inspired), all via CSS variables in `globals.css`. Landing: nav + announce pill + verb rotator + before/after + how-it-works (terminal block) + live-proof section + Sui logo footer ("Built on Sui ♥", official untweaked logo at `public/sui-logo-white.svg`).
- Rotator gotcha: `clip-path: inset(0)` required — `overflow:hidden` alone doesn't clip composited `background-clip:text` layers in Chromium. No text-shadow on the rolling words (clipped glow = visible frame).
- dapp-kit gotcha: NEVER style `[data-dapp-kit] button` globally — it leaks into the portal modal. Scope to `.connect-btn-wrap`.
- Seal gotcha: key-id must be **exactly 32 bytes** (trust id, plain whitelist) or **32+8** (time-locked). `lib/seal`'s 5-byte nonce convention is incompatible with deployed `seal_policy` — frontend uses `frontend/src/lib/seal-docs.ts` (browser-adapted, correct id format).
- `frontend/.env.local` is a **symlink to root `.env`** (MemWal creds for the memories route).
- Help panel: sidebar `?` → accordion (what/roles/rules/DMS/stack) + Replay intro. Icon set: Orbit/Sprout/Vault/Fingerprint/Radar/BrainCircuit/Signature/HeartPulse/HandCoins/BookLock.

## Dev burner wallet (for testing)

- `frontend/src/lib/burner-wallet.ts` — registered via wallet-standard, same dapp-kit signing path as Slush. Enable: `localStorage.trustea-burner = "1"` (+ optional `trustea-burner-key` = suiprivkey to reuse a funded key). Appears as "Trustea Burner (Dev)" in the connect modal.
- Current burner: `0x1d2737bbab2fc43215c48f6fa3cff13f819354b272cf7d738817fcbbd1e5bdc1` (funded 0.4 SUI from deployer). Deployer `0xe50e...8b56` has ~0.24 SUI left — **top up via faucet before more testing** (faucet.sui.io, IP rate-limited via VPN).
- Dev server: `cd frontend && npm run dev` (port 37500). Don't run `next build` while dev server runs — corrupts the CSS cache (restart dev server if styles go missing).

## NOT done yet (the gap to winning)

1. **Demo video** — highest leverage; 50% judging weight on real-world application. Script docs: ideation/10, 21, 24.
2. **Granular commits** — ENTIRE working tree is uncommitted (Nik's instruction). Single-commit = auto-DQ. Proposed sequence: contracts redeploy → design system → wizard → trust actions → beneficiary page → agent/memory live data → onboarding+help → landing → Seal docs → burner wallet + fixes. Needs Nik's go-ahead.
3. **Credential issuer** — no credential Move module exists; agent checks owned-object type substrings (agent/src/condition-monitor.ts). ~Half day: tiny attestation NFT module + mint page. Closes the "who attests the drug test?" judge question.
4. **Walrus Sites deployment** — full plan in `ideation/25-walrus-sites-deployment.md`. Blocked on: where the translate/memories proxy lives (candidate: OVH Singapore box).
5. **Fresh agent run** the morning of recording (so Memory page shows live recall).

## Honest rating trajectory

7.5 (June 11, pre-e2e) → **8.5 now** (critical path proven, Seal visible in product). 9+ requires items 1–2 above done well. Anna does frontend tweaks on top of this; everything is CSS-variable-driven and componentized for that.

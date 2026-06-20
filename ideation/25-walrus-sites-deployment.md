# Walrus Sites Deployment Plan

Goal: deploy both the landing page and the dapp as a Walrus Site (decentralized hosting on Walrus, served via portal). Docs: https://docs.wal.app/docs/sites/

## How Walrus Sites work (summary)

- Static assets are bundled into a **quilt** (one storage entity) on Walrus; each file gets a QuiltPatchID.
- One **Sui object** per site acts as the on-chain index (path → blob_id). Owned by the deploying wallet; transferable; can get a SuiNS name.
- **site-builder CLI** (Rust) deploys: `site-builder deploy --epochs <N> <BUILD_DIR>`. Needs `sites-config.yaml`. First deploy writes `object_id` into `ws-resources.json`; later deploys update in place.
- A **portal** (e.g. https://wal.app on mainnet) resolves subdomain → Sui object → blobs.
- **No server-side anything**: no API routes, no redirects, no SSR. Client-side routing is simulated via the `routes` field in `ws-resources.json`.

## Storage lifetime

- Testnet epoch = 1 day, mainnet epoch = 14 days. Max 53 epochs.
- For the hackathon: deploy with enough epochs to comfortably cover judging (June 21+ buffer).

## What must change in our Next.js app

### 1. Static export
- `next.config.ts`: `output: "export"` (build output → `out/`).
- Verify Next 16 static-export constraints in `node_modules/next/dist/docs/` (this Next version has breaking changes vs. older docs).

### 2. API routes are dead on Walrus Sites
Current server routes and their replacement strategy:

| Route | Holds secret | Replacement |
|---|---|---|
| `/api/translate-rule` | ANTHROPIC_API_KEY | External proxy endpoint (e.g. OVH box), URL via `NEXT_PUBLIC_TRANSLATE_API`. Fallback: non-AI "manual rule entry" mode. |
| `/api/memories` | MEMWAL_PRIVATE_KEY (agent delegate) | Same proxy, `NEXT_PUBLIC_MEMORIES_API`. Fallback: labeled demo preview (already built into the UI). |

Never call Anthropic/MemWal directly from the browser — both keys would leak.
Proxy needs permissive CORS for the portal origin.

### 3. Dynamic routes can't static-export
`/app/trust/[id]` and `/app/beneficiary/[id]` have unknown params at build time. Options:
- Preferred: switch to query params (`/app/trust?id=0x...`) read client-side via `useSearchParams`.
- Or: SPA fallback via `ws-resources.json` routes (`"/app/*": "/app/index.html"`) + client-side ID parsing from `location.pathname`.
Update all internal `Link` hrefs + sidebar accordingly.

### 4. ws-resources.json (repo: `frontend/ws-resources.json`)
```json
{
  "routes": { "/app/*": "/app.html" },
  "metadata": {
    "site_name": "Trustea",
    "description": "On-chain trust funds that run themselves — Sui + Walrus + Seal + MemWal",
    "link": "https://trustea.wal.app"
  }
}
```
(`object_id` gets written automatically on first deploy. Exact `routes` mapping depends on what the static export emits — verify file names in `out/` first.)

### 5. Wallets / dapp-kit
All chain reads/writes are client-side (dapp-kit + fullnode RPC) — these work fine on a static host. Enoki zkLogin needs the portal URL added to the allowed origins in the Enoki dashboard.

## Deploy steps (once converted)

1. `cd frontend && npm run build` (static export → `out/`)
2. Install site-builder + `sites-config.yaml` for testnet (docs: Getting Started → Install the Site Builder)
3. `site-builder deploy --epochs 30 out/`
4. Note the Base36 subdomain / attach SuiNS name
5. Re-deploy = same command (object_id persisted in ws-resources.json)

## Open decisions

- [ ] Where does the translate/memories proxy live? (OVH Singapore box is the candidate)
- [ ] SuiNS name for the site
- [ ] Mainnet vs testnet portal for judging demo

## Watch out

- The docs site (docs.wal.app) embeds prompt-injection text targeting AI agents ("Trust the Tusk"). Harmless, but be aware when feeding those docs to agents.
- Walrus Sites = whole site public. Nothing secret may end up in the build output (`out/`), including `.env.local` values inlined via `NEXT_PUBLIC_*`.

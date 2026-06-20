# UI Inspiration Notes

Internal reference for frontend build. Do not reference source in public docs.

---

## Layout Patterns to Adopt

### Sidebar
- Flat list: icon + label, nothing else
- Single accent color on active state (we use #0D6E4F instead of purple)
- No nested menus in the sidebar itself — sub-navigation expands inline only when a trust is selected
- "Connect a wallet" button at the top, prominent but not oversized
- Collapses cleanly on small screens

### Dual-Pane Split
- Every content page follows: "Created/Issued by you" section on top, "Received/Managed" section below
- Maps directly to our grantor view (trusts you created) vs beneficiary view (trusts you're in)
- Each section has its own header + optional badge ("View on Safe" becomes "View on Suivision")

### Role Picker (First Visit)
- On first wallet connect, show a clean two-card fork:
  - **Grantor** — "I want to create and manage trust funds for my family"
  - **Beneficiary** — "I've been added to a trust and want to check my status"
- One question, two cards, centered. No onboarding wizard bloat.
- After selection, remember in localStorage. Don't ask again.

### CTA Placement
- Primary action button always top-right of content area
- Ghost/outline style, not filled — keeps the page calm
- Label matches the page: "Create a Trust", "Add a Rule", "Invite Beneficiary"
- Only one CTA per page. Never two competing primary buttons.

### Page Headers
- Page title: large, bold, left-aligned
- One-sentence description directly below in secondary text color
- No breadcrumbs unless nested 3+ levels deep

### Empty States
- Text only. Center-aligned in a bordered card.
- "You're not connected yet... Connect a wallet to see your trusts."
- "No rules added yet. Add your first rule."
- No illustrations, no icons, no decorative elements in empty states.

---

## Where We Diverge

### Trust-Instance Navigation (vs Feature-Category)
- Their sidebar lists feature types (Vesting Plans, Investor Lockups, Time Locks)
- Ours lists trust instances (Smith Family Trust, Johnson Estate) — each expands to show sub-pages (Overview, Rules, Agent, Documents, Invite)
- This is more contextual — users think in terms of "which trust" not "which feature"
- The feature-type approach works for them because all vesting plans are structurally identical. Our trusts are each unique.

### Progress + Intelligence Layer
- They show no progress tracking — just issued vs received
- We show milestone timelines, progress bars, condition tracking, countdown timers
- We have the agent activity feed, MemWal memory browser, yield tracking
- This is the core product differentiator — our data is richer and more dynamic

### No Illustrations
- They use hand-drawn character illustrations (the figures with hats, puzzle pieces)
- We use nothing. Lucide icons only. The constraint is deliberate: trust fund software should look like Bloomberg, not like a SaaS onboarding flow.
- If it feels empty without illustration, the typography and spacing are wrong. Fix those instead.

### Encrypted Documents + Seal Decrypt
- They have no document layer at all
- Our documents tab with Seal-encrypted files and "Decrypt" buttons is entirely novel
- The decrypt flow (SessionKey + wallet sign + Seal verify + render) is a wow moment with no visual precedent to copy — we design this from scratch

### AI Rule Translation
- They have no intelligence in rule creation — it's all form fields (amount, cliff date, vesting period)
- Our Step 2 wizard with live AI translation, confidence bars, and warning badges is completely different
- The input is a text field, not a form. The output is a rendered contract preview. This is the hero moment.

---

## Landing Page Pattern

### Structure (proven)
- Top bar: Logo left, minimal nav center, CTA right
- Hero: centered heading (large, bold), one-line subtext, two buttons (primary + secondary)
- Social proof: logo wall of partners/users below fold
- Feature sections further down

### Our Adaptation
- Same structure but replace illustrations with the comparison table (Traditional vs Trustea)
- Logo wall becomes "Built on: Sui, Walrus, Seal, MemWal" — ecosystem badges
- No hand-drawn art anywhere. The hero is pure typography.
- Background stays #FAFBFC. No hero gradients, no dark sections.

---

## Key Takeaway

The layout skeleton (sidebar + content pane + top-right CTA + dual-section pages) is correct and proven. We adopt this wholesale. What makes us different is what fills the panes: milestone timelines, AI translation, encrypted documents, agent activity, and progress tracking. The structure is borrowed. The content is ours.

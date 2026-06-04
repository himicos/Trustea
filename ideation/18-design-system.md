# Trustea — Design System & UI Constraints

## The Vibe

**"Institutional infrastructure that happens to be beautiful."**

Trustea should look like something Mysten Labs built internally — or like a premium fintech product backed by serious engineering. Not a hackathon project. Not a consumer app. Not crypto-bro. Not playful.

**Reference products** (study these, steal the feeling):
- **Linear** — information density without clutter, keyboard-first, monochrome with one accent
- **Suivision explorer** — clean data presentation, Sui ecosystem native aesthetic
- **Mercury Bank** — premium fintech, whitespace-heavy, typography-driven
- **Stripe Dashboard** — data-dense but calm, progressive disclosure
- **Notion** — restrained, systematic, everything has a reason

**Not like:**
- Uniswap (too playful, too much gradient)
- OpenSea (too consumer, too card-heavy)
- Any project with neon colors, dark mode gamer aesthetic, or animated backgrounds

---

## Hard Constraints

These are non-negotiable. Every component, every page, every interaction must obey these.

### 1. No emojis in the UI
Icons only. Use Lucide icons (consistent with Sui ecosystem) or Radix Icons. Emojis are for Slack, not for a product managing someone's family wealth.

### 2. No gradients
Flat colors only. Gradients signal "consumer app" or "crypto landing page". We signal "institutional tool".

### 3. No dark mode (for now)
Ship light mode only. Dark mode is a distraction — it doubles the design surface. One mode, done perfectly. Deep green sidebar is the only dark element.

### 4. Maximum two font weights per element
- Headings: Inter 600 (semibold)
- Body: Inter 400 (regular)
- Mono data: JetBrains Mono 400

Never use bold (700) for body text. Never use light (300). The constraint forces hierarchy through size and color, not weight.

### 5. One accent color
Deep green (#0D6E4F) is the single accent. It appears on:
- Primary CTA buttons
- Sidebar background
- Active nav states
- Progress bars (via #10B981 emerald variant)

Everything else is grey scale. Sui blue (#4DA2FF) appears ONLY on ecosystem badges and external links — never as a UI control color.

### 6. No border-radius > 12px
Cards: 8px. Buttons: 8px. Inputs: 6px. Modals: 12px. Nothing rounder. Round corners signal playfulness. Tight corners signal precision.

### 7. No shadows deeper than `shadow-sm`
One level of elevation only. Cards float slightly above the background. Nothing else casts shadows. No `shadow-lg`, no `shadow-xl`, no drop shadows on text.

### 8. No animations longer than 200ms
State transitions: 150ms ease. Page transitions: 200ms. Toasts: 200ms slide-in. Nothing bounces. Nothing springs. Nothing overshoots. Financial software doesn't wiggle.

### 9. Monospace for all on-chain data
Addresses, transaction hashes, blob IDs, object IDs, amounts in MIST — all rendered in JetBrains Mono. This signals "real data from a real blockchain" and aids scanning hex strings.

### 10. No placeholder images or illustrations
If we don't have the real asset, show nothing. An empty state with text ("No documents yet") is better than a stock illustration of a person holding a laptop. The only graphic asset is the Trustea logo.

---

## Color Palette (Exact Values)

### Core

| Name | Hex | Usage |
|------|-----|-------|
| Green Primary | `#0D6E4F` | CTAs, sidebar bg, active states |
| Green Light | `#10B981` | Success indicators, progress fills, "active" dots |
| Green Surface | `#ECFDF5` | Success alert backgrounds |

### Neutrals

| Name | Hex | Usage |
|------|-----|-------|
| Background | `#FAFBFC` | Page background |
| Surface | `#FFFFFF` | Cards, modals, inputs |
| Border | `#E5E7EB` | Card borders, dividers |
| Border Strong | `#D1D5DB` | Input borders (focused state uses Green Primary) |

### Text

| Name | Hex | Usage |
|------|-----|-------|
| Primary | `#1A1A2E` | Headings, body text |
| Secondary | `#6B7280` | Labels, descriptions, secondary info |
| Muted | `#9CA3AF` | Timestamps, metadata, disabled text |
| Inverse | `#FFFFFF` | Text on green backgrounds (sidebar, buttons) |

### Semantic

| Name | Hex | Usage |
|------|-----|-------|
| Warning | `#F59E0B` | Confidence < 90%, pending states, veto window |
| Warning Surface | `#FFFBEB` | Warning alert backgrounds |
| Error | `#EF4444` | Errors, confidence < 70%, destructive actions |
| Error Surface | `#FEF2F2` | Error alert backgrounds |
| Info (Sui Blue) | `#4DA2FF` | External links, ecosystem badges ONLY |
| Info Surface | `#EFF6FF` | Info alert backgrounds |

### Sidebar

| Name | Hex | Usage |
|------|-----|-------|
| Sidebar BG | `#0D6E4F` | Sidebar background |
| Sidebar Text | `#FFFFFF` | Primary sidebar text |
| Sidebar Muted | `#FFFFFF99` | Secondary sidebar text (60% opacity) |
| Sidebar Active | `#FFFFFF1F` | Selected item background (12% white) |
| Sidebar Hover | `#FFFFFF0F` | Hovered item background (6% white) |

---

## Typography

### Scale

| Element | Size | Weight | Font | Line Height |
|---------|------|--------|------|-------------|
| Page title | 24px | 600 | Inter | 32px |
| Section heading | 18px | 600 | Inter | 28px |
| Card title | 16px | 600 | Inter | 24px |
| Body | 14px | 400 | Inter | 20px |
| Small / label | 13px | 400 | Inter | 18px |
| Caption / meta | 12px | 400 | Inter | 16px |
| Mono data | 13px | 400 | JetBrains Mono | 18px |

### Rules
- Line length: max 680px for body text (readability)
- Paragraph spacing: 16px between paragraphs
- Section spacing: 32px between sections
- No uppercase text except for tiny labels (e.g., "STATUS", "BALANCE") and only at 11px/500 weight with letter-spacing: 0.05em
- Numbers in tables: right-aligned, tabular-nums

---

## Spacing System

8px base grid. Everything aligns to multiples of 8.

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Inline icon gaps, tight padding |
| `space-2` | 8px | Input padding, small gaps |
| `space-3` | 12px | Card internal padding (compact) |
| `space-4` | 16px | Default card padding, between elements |
| `space-5` | 24px | Between sections within a card |
| `space-6` | 32px | Between cards, major section breaks |
| `space-8` | 48px | Page section gaps |
| `space-10` | 64px | Hero section spacing |

---

## Component Specs

### Buttons

```
Primary:    bg #0D6E4F, text white, 8px radius, 14px Inter 500
            hover: #0A5A40 (darken 10%)
            padding: 10px 20px
            min-height: 40px

Secondary:  bg transparent, border 1px #D1D5DB, text #1A1A2E
            hover: bg #F9FAFB
            same sizing as primary

Destructive: bg transparent, border 1px #FCA5A5, text #EF4444
             hover: bg #FEF2F2

Ghost:      bg transparent, no border, text #6B7280
            hover: bg #F3F4F6
            used for less important actions (Edit, Remove)
```

No button icons. If an action needs an icon, it's a separate icon button (square, 36x36px). Text buttons say what they do. "Create Trust", not an icon of a plus sign.

### Cards

```
bg: white
border: 1px solid #E5E7EB
radius: 8px
padding: 20px
shadow: 0 1px 2px rgba(0,0,0,0.05)   ← shadow-sm only

hover (if clickable): border-color #D1D5DB, shadow 0 1px 3px rgba(0,0,0,0.08)
```

### Inputs

```
bg: white
border: 1px solid #D1D5DB
radius: 6px
padding: 10px 12px
font: 14px Inter 400
placeholder: #9CA3AF

focus: border-color #0D6E4F, ring 2px #0D6E4F at 20% opacity
error: border-color #EF4444, ring 2px #EF4444 at 20% opacity
```

### Tables

```
Header row: bg #F9FAFB, text 12px/500 #6B7280 uppercase tracking-wide
Body rows: bg white, border-bottom 1px #F3F4F6
Row hover: bg #F9FAFB
Numeric columns: right-aligned, JetBrains Mono
```

### Progress Bars

```
Track: bg #E5E7EB, height 6px, radius 3px
Fill: bg #10B981, radius 3px
No animation on load. Fill width is purely data-driven.
```

### Status Dots

```
Active:    #10B981 (8px circle)
Pending:   #F59E0B (8px circle)
Inactive:  #9CA3AF (8px circle)
Error:     #EF4444 (8px circle)
```

### Toasts

```
Position: bottom-right
bg: white, border 1px #E5E7EB, shadow-sm
Left accent bar: 3px wide, color matches type (green/amber/red)
Auto-dismiss: 5 seconds
Enter: slide-up 200ms
Exit: fade-out 150ms
```

---

## Layout

### Sidebar
- Width: 260px (desktop), collapses to 56px (icons only) on small screens
- Background: #0D6E4F
- Position: fixed left
- z-index: 40

### Main Content
- Left margin: 260px (desktop)
- Max width: 1200px
- Padding: 32px horizontal, 24px vertical
- Centered within remaining space

### Page Structure
```
┌─────────┬─────────────────────────────────────────┐
│         │  Breadcrumb / page title        actions  │
│ Sidebar │  ─────────────────────────────────────── │
│  260px  │                                          │
│         │  Content area (max 1200px centered)      │
│         │                                          │
│         │                                          │
│         │                                          │
└─────────┴─────────────────────────────────────────┘
```

No top nav bar. The sidebar IS the navigation. Page title sits at the top of the content area with optional action buttons (right-aligned).

---

## Iconography

Use **Lucide** icon set (MIT licensed, consistent with Sui ecosystem tools).

| Concept | Icon |
|---------|------|
| Trust | `shield` |
| Beneficiary | `user` |
| Rules | `scroll-text` |
| Agent | `bot` |
| Memory | `brain` |
| Documents | `file-text` |
| Encrypt/Lock | `lock` |
| Wallet | `wallet` |
| Deposit | `arrow-down-to-line` |
| Distribution | `arrow-up-from-line` |
| Settings | `settings` |
| Copy | `copy` |
| External link | `external-link` |
| Check/success | `check` |
| Warning | `alert-triangle` |
| Error | `x-circle` |
| Clock/pending | `clock` |
| Yield/growth | `trending-up` |
| Add | `plus` |
| Menu collapse | `panel-left-close` |

Icon size: 16px inline with text, 20px in nav items, 24px standalone.
Icon color: inherits text color (never colored independently except status dots).

---

## What This Means for Anna

When Anna starts on components:

1. **Start with Tailwind config** — set up the exact color tokens, font families, spacing scale, and border-radius values from this doc as Tailwind theme extensions.

2. **Build atoms first** — Button, Input, Card, Badge, StatusDot, ProgressBar, Toast. These 7 components compose everything else.

3. **Sidebar is the first full component** — it establishes the navigation pattern and the green-on-white contrast that defines the brand.

4. **No creative freedom on colors or spacing** — the system is locked. Creative freedom is in layout composition, content hierarchy, and micro-copy.

5. **Every screenshot for the README should look like it came from the same product** — consistency over individual page beauty.

---

## Anti-Patterns (Things to Avoid)

- Colored icons (icons inherit text color, period)
- Cards with colored backgrounds (all cards are white)
- Multiple CTAs of the same visual weight on one screen
- Scrollable areas within scrollable areas (nested scroll)
- Tooltips that require hover to understand the UI (tooltips are supplementary only)
- Loading spinners (use skeleton/shimmer states instead)
- "Welcome back!" or "Hey there!" copy (formal, not friendly)
- Any text that starts with "Oops!" or uses exclamation marks
- "Are you sure?" confirmation dialogs (use inline destructive actions with undo instead)
- Empty states with illustrations (text-only: "No rules added yet. Add your first rule.")

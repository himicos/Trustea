import Link from "next/link";
import { RoutePrewarmer } from "@/components/route-prewarmer";
import {
  ArrowRight,
  Clock3,
  ShieldCheck,
  Lock,
  Fingerprint,
  Landmark,
  Database,
  ExternalLink,
  Heart,
} from "lucide-react";

const PACKAGE_ID =
  "0xa3e912b4d4be96e1206bd76cdadb512fe151b9dfd6921bd9afc9be1d97a8487a";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <RoutePrewarmer />
      <Nav />
      <Hero />
      <TechStrip />
      <StatRow />
      <HowItWorks />
      <MemoryCompounds />
      <Features />
      <Comparison />
      <Team />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ── Nav ── */

function Nav() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <svg width={28} height={28} viewBox="0 0 2000 2000">
            <polygon fill="#10B981" points="928 781 1021 951 784.5 1371.97 1618 1371.97 1530.32 1544 509 1539 928 781" />
            <polygon fill="#059669" points="1618 1371.97 784.5 1371.97 874.93 1211 1346 1211 923.1 456 1110.06 456 1618 1371.97" />
            <polygon fill="#0D6E4F" points="418 1372.74 509 1539 928 781 1162.32 1211 1346 1211 923.1 456 418 1372.74" />
          </svg>
          <span className="font-semibold tracking-tight lowercase">trustea</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <a href="#how" className="landing-nav-link">How it works</a>
          <a href="#memory" className="landing-nav-link">Memory</a>
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="#comparison" className="landing-nav-link">vs Traditional</a>
          <a href="#team" className="landing-nav-link">Team</a>
        </div>
        <Link href="/app" className="btn btn-primary btn-sm">
          Open App
        </Link>
      </div>
    </nav>
  );
}

/* ── Hero ── */

function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center px-6 pt-24 pb-24 text-center overflow-hidden min-h-[88vh]">
      <div className="aurora aurora-hero-1" />
      <div className="aurora aurora-hero-2" />

      {/* Live testnet announce pill */}
      <a
        href={`https://testnet.suivision.xyz/package/${PACKAGE_ID}`}
        target="_blank"
        rel="noopener noreferrer"
        className="announce-pill relative z-10 mb-9"
      >
        <span className="pill-tag">Live</span>
        Deployed on Sui Testnet — inspect the contracts
        <ArrowRight size={12} />
      </a>

      {/* Triangle logo */}
      <div className="flex justify-center mb-8 relative z-10">
        <svg className="trustea-logo !w-[96px] !h-[96px]" viewBox="0 0 2000 2000">
          <polygon className="shard-1" points="928 781 1021 951 784.5 1371.97 1618 1371.97 1530.32 1544 509 1539 928 781" />
          <polygon className="shard-3" points="1618 1371.97 784.5 1371.97 874.93 1211 1346 1211 923.1 456 1110.06 456 1618 1371.97" />
          <polygon className="shard-2" points="418 1372.74 509 1539 928 781 1162.32 1211 1346 1211 923.1 456 418 1372.74" />
        </svg>
      </div>

      <h1 className="display-type text-5xl md:text-[68px] font-semibold mb-6 relative z-10 max-w-3xl leading-[1.08]">
        Write trust rules
        <br />
        in plain English.
        <br />
        <span className="font-serif-display text-green-light">AI enforces them.</span>
      </h1>

      <p className="text-lg text-text-secondary mb-9 max-w-lg mx-auto leading-relaxed relative z-10">
        Replace $30k/year in trust administration fees with smart contracts
        and an AI trustee that runs on-chain — for decades.
      </p>

      {/* Hero terminal */}
      <div className="relative z-10 max-w-2xl w-full mx-auto mb-10">
        <HeroTerminal />
      </div>

      <div className="flex gap-3 justify-center items-center relative z-10">
        <Link href="/app" className="btn-glow">
          <span className="btn-glow-border" />
          <span className="btn-glow-inner">
            <span>Open App</span>
            <ArrowRight size={18} />
          </span>
        </Link>
        <a href="#how" className="btn btn-secondary btn-lg">
          How it works
        </a>
      </div>
    </section>
  );
}

function HeroTerminal() {
  return (
    <div className="terminal text-left">
      <div className="terminal-bar">
        <span /><span /><span />
        <p className="text-[10px] uppercase tracking-wider text-text-muted ml-2">
          rule translator
        </p>
      </div>
      <div className="terminal-body">
        <span className="t-prompt">$ </span>
        <span className="t-input">
          trustea.add_rule(<span className="t-str">&quot;Release $50k to Alice when she turns 25&quot;</span>)
        </span>
        {"\n"}
        <span className="t-dim">  ✓ compiled → AND/OR logic deployed on-chain</span>
        {"\n\n"}
        <span className="t-prompt">$ </span>
        <span className="t-input">
          trustea.add_rule(<span className="t-str">&quot;Pay tuition if enrolled, suspend if convicted&quot;</span>)
        </span>
        {"\n"}
        <span className="t-dim">  ✓ compound condition active · monitoring 24/7</span>
      </div>
    </div>
  );
}

/* ── Tech strip ── */

function TechStrip() {
  return (
    <div className="tech-strip">
      <span className="strip-label">Built with</span>
      <div className="stag">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 22,20 2,20" /></svg>
        Sui Move
      </div>
      <div className="stag">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
        Walrus
      </div>
      <div className="stag">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        Seal Encryption
      </div>
      <div className="stag">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
        MemWal
      </div>
      <div className="stag">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 6v6l4 2" /></svg>
        Model-Agnostic AI
      </div>
    </div>
  );
}

/* ── Stat row ── */

function StatRow() {
  const stats = [
    ["$124T", "Wealth transferring by 2048"],
    ["$15.5B", "Annual admin industry"],
    ["1–2%", "AUM taken in fees annually"],
    ["~$2", "Trustea onboarding cost"],
  ];
  return (
    <div className="stat-row">
      {stats.map(([num, label]) => (
        <div key={label} className="stat">
          <div className="stat-num">{num}</div>
          <div className="stat-label">{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── How it works ── */

const STEPS = [
  {
    n: "01",
    title: "Write rules in plain English",
    body: "No legal jargon. The AI translates compound conditions — age milestones, enrollment, conviction status — into enforceable on-chain logic.",
  },
  {
    n: "02",
    title: "AI trustee monitors 24/7",
    body: "Model-agnostic agent checks conditions continuously and proposes distributions. Grantor keeps a configurable veto window on every action.",
  },
  {
    n: "03",
    title: "Executes on-chain, permanently",
    body: "Every decision is Seal-encrypted and stored on Walrus via MemWal. Private, verifiable, reconstructable 50 years from now.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="how-inner">
          <div>
            <div className="sec-label">How it works</div>
            <h2 className="sec-title">
              Three steps.
              <br />
              <em>Runs for decades.</em>
            </h2>
            <p className="sec-sub mb-8">
              Trustea replaces paper filings and lawyer phone calls with verifiable
              on-chain logic that executes automatically — with a human in the loop.
            </p>
            <div className="how-steps">
              {STEPS.map((s) => (
                <div key={s.n} className="hstep">
                  <span className="hstep-n">{s.n}</span>
                  <div>
                    <div className="hstep-t">{s.title}</div>
                    <div className="hstep-d">{s.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="how-visual">
            <div className="vis-label">Live rules</div>
            <div className="rule-card active">
              <span className="rk">if</span> Alice.age &gt;= <span className="rs">25</span>:
              <br />
              &nbsp;&nbsp;release(<span className="rs">50_000 USDC</span>)
              <div className="rtag">✓ triggered · distributing</div>
            </div>
            <div className="rule-card">
              <span className="rk">if</span> Bob.enrolled <span className="rk">AND NOT</span> Bob.convicted:
              <br />
              &nbsp;&nbsp;pay(tuition, <span className="rs">semester</span>)
            </div>
            <div className="divider" />
            <div className="vis-label">Agent audit log · Seal-encrypted</div>
            <div className="arow">
              <span className="arow-e">distribution_proposed</span>
              <span className="arow-s"><span className="n">🔒</span> Walrus</span>
            </div>
            <div className="arow">
              <span className="arow-e">veto_window_open · 47h left</span>
              <span className="arow-s"><span className="n">🔒</span> Walrus</span>
            </div>
            <div className="arow">
              <span className="arow-e">condition_check · enrolled=true</span>
              <span className="arow-s"><span className="n">🔒</span> Walrus</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Memory compounds ── */

function MemoryCompounds() {
  return (
    <section id="memory" className="py-24 border-t border-border bg-surface/30">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="sec-label">Why memory matters</div>
          <h2 className="sec-title">
            A trustee that <em>compounds.</em>
            <br />
            Year over year.
          </h2>
          <p className="sec-sub mx-auto">
            Traditional trustees retire, lose context, change firms. An AI trustee
            with persistent memory on Walrus only gets sharper — every decision
            becomes context for the next one. For thirty years. For sixty.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-8">
          <div className="card">
            <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-2">
              Year 1 · cold start
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Agent gets a rule, checks conditions, proposes a distribution. No prior
              context. Decisions are mechanical — exactly what the rule says, nothing
              more.
            </p>
          </div>
          <div className="card-glow">
            <p className="text-[10px] uppercase tracking-wider text-green-light font-semibold mb-2">
              Year 5 · 60+ decisions later
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Agent recalls every prior cycle. Before proposing, it asks itself:{" "}
              <span className="font-serif-display text-green-light">
                have I seen this pattern before?
              </span>{" "}
              Context-aware. Cautious where it should be.
            </p>
          </div>
        </div>

        {/* Loop diagram */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-mono">
          <span className="px-3 py-1.5 rounded-lg border border-green-primary/30 bg-green-surface text-green-light">
            condition fires
          </span>
          <span className="text-text-muted">→</span>
          <span className="px-3 py-1.5 rounded-lg border border-info/30 bg-info-surface text-info">
            MemWal recall
          </span>
          <span className="text-text-muted">→</span>
          <span className="px-3 py-1.5 rounded-lg border border-green-primary/30 bg-green-surface text-green-light">
            propose with context
          </span>
          <span className="text-text-muted">→</span>
          <span className="px-3 py-1.5 rounded-lg border border-info/30 bg-info-surface text-info">
            write back to MemWal
          </span>
        </div>
        <p className="text-center text-xs text-text-muted mt-4">
          Every cycle the loop closes. Memory makes the agent better.
        </p>
      </div>
    </section>
  );
}

/* ── Features ── */

const FEATURES = [
  {
    icon: Clock3,
    title: "AI Rule Translator",
    body: "12 real-world patterns: age milestones, HEMS, incentive matching, bankruptcy protection. Works with Groq, Claude, GPT, or local LLMs — model-agnostic.",
  },
  {
    icon: ShieldCheck,
    title: "Human Override",
    body: "Grantor or trust protector can veto any AI-proposed action within a configurable window (default 48h). You stay in control — always.",
  },
  {
    icon: Lock,
    title: "Seal Encryption",
    body: "Trust documents and AI decisions identity-encrypted via Seal. Only authorized parties can decrypt — not even Trustea.",
  },
  {
    icon: Fingerprint,
    title: "Soulbound NFTs",
    body: "Non-transferable beneficiary NFTs encode allocation rights and access rules directly into the wallet. No counterparty risk.",
  },
  {
    icon: Landmark,
    title: "Real-World Asset Tokens",
    body: "Represent real estate, securities, vehicles as soulbound tokens with on-chain valuation tracking. The full estate — on-chain.",
  },
  {
    icon: Database,
    title: "Agent memory that compounds",
    body: "MemWal stores every decision Seal-encrypted on Walrus. Before each cycle the agent recalls similar past cases by semantic search — the trustee gets better the longer your trust runs.",
  },
];

function Features() {
  return (
    <section id="features" className="py-24 border-t border-border bg-surface/30">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="sec-label">Features</div>
          <h2 className="sec-title">
            Everything a traditional trust does —
            <br />
            <em>and what it can&apos;t.</em>
          </h2>
        </div>
        <div className="feat-grid">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="feat">
                <div className="feat-icon"><Icon size={20} /></div>
                <div className="feat-t">{f.title}</div>
                <div className="feat-d">{f.body}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Comparison ── */

const ROWS: Array<[string, string, string]> = [
  ["Admin onboarding", "$2,000 – $5,000", "~$2 in gas fees"],
  ["Annual administration", "$15k–$30k on $1M AUM", "Near $0"],
  ["Beneficiary requests", "Phone calls and letters", "Self-service on-chain"],
  ["Audit trail", "Filing cabinet", "Encrypted on Walrus, forever"],
  ["Privacy", "Lawyers see everything", "Seal — authorized parties only"],
  ["Compound rules", "Lawyer interpretation", "AI + AND/OR logic on-chain"],
  ["30-year cost on $5M", "$150k – $450k+", "$15k – $60k"],
];

function Comparison() {
  return (
    <section id="comparison" className="py-24 border-t border-border">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="sec-label">Trustea vs Traditional</div>
          <h2 className="sec-title">
            The numbers <em>don&apos;t lie.</em>
          </h2>
        </div>
        <table className="ct">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Traditional trust</th>
              <th>Trustea</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([feat, trad, tru]) => (
              <tr key={feat}>
                <td>{feat}</td>
                <td>{trad}</td>
                <td>{tru}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ── Team ── */

function Team() {
  return (
    <section id="team" className="py-24 border-t border-border bg-surface/30 relative overflow-hidden">
      <div className="aurora aurora-hero-2" />
      <div className="max-w-4xl mx-auto px-6 relative">
        <div className="text-center mb-12">
          <div className="sec-label">The team</div>
          <h2 className="sec-title">
            Built at <em>Sui Overflow 2026</em>
          </h2>
        </div>
        <div className="team-grid">
          <div className="team-card">
            <div className="avatar">N</div>
            <div className="team-name">Nikita</div>
            <div className="team-role">Contracts · Agent · Infra</div>
            <p className="team-bio">
              Wrote the Move contracts, the AI trustee, and stitched together
              Walrus, Seal, and MemWal into one pipeline.
            </p>
            <div className="team-tags">
              <span className="ttag">Sui Move</span>
              <span className="ttag">AI agents</span>
              <span className="ttag">Walrus</span>
              <span className="ttag">TypeScript</span>
            </div>
          </div>
          <div className="team-card">
            <div className="avatar">A</div>
            <div className="team-name">Anna, her majesty</div>
            <div className="team-role">Design · Frontend</div>
            <p className="team-bio">
              Designed every pixel of what you&apos;re looking at. Turns
              compound-trust ideas into things people actually want to use.
            </p>
            <div className="team-tags">
              <span className="ttag">Design</span>
              <span className="ttag">Frontend</span>
              <span className="ttag">UX</span>
              <span className="ttag">TU Graz</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ── */

function FinalCta() {
  return (
    <section className="py-28 border-t border-border relative overflow-hidden text-center">
      <div className="aurora aurora-cta" />
      <div className="max-w-2xl mx-auto px-6 relative">
        <div className="sec-label">Get started</div>
        <h2 className="display-type text-4xl md:text-5xl font-semibold mb-6 leading-tight">
          Your legacy deserves
          <br />
          infrastructure that <span className="font-serif-display text-green-light">lasts.</span>
        </h2>
        <p className="sec-sub mx-auto mb-10">
          Explore the contracts, read the docs, or launch the app to create
          your first on-chain trust.
        </p>
        <div className="flex gap-3 justify-center items-center">
          <Link href="/app" className="btn-glow">
            <span className="btn-glow-border" />
            <span className="btn-glow-inner">
              <span>Open App</span>
              <ArrowRight size={18} />
            </span>
          </Link>
          <a
            href="https://github.com/himicos/Trustea"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-lg"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ── */

function Footer() {
  return (
    <footer className="border-t border-border py-10 px-6 relative">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-6">
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <span>Built on</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sui-logo-white.svg" alt="Sui" className="h-6 w-auto" />
          <span>with</span>
          <Heart size={15} className="text-green-light fill-green-light" />
        </div>
        <div className="w-full flex items-center justify-between text-xs text-text-muted">
          <span>Trustea — on-chain trust infrastructure</span>
          <a
            href={`https://testnet.suivision.xyz/package/${PACKAGE_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-green-light flex items-center gap-1"
          >
            Sui Overflow 2026 · Walrus Track <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </footer>
  );
}

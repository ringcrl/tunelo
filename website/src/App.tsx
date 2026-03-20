import { useState } from "react";
import "./index.css";

const SKILL_MD = `# Install
curl -fsSL https://tunelo.net/install.sh | sh

# Expose a local HTTP service
tunelo http 3000

# With a custom subdomain
tunelo http 3000 --subdomain myapp

# Forward to a different host
tunelo http 8080 -H 192.168.1.100`;

const SKILL_INSTALL = `npx -y skills add tunelo/tunelo`;

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--tunelo-gray-800)] bg-[var(--tunelo-dark)]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 text-white font-semibold text-lg tracking-tight">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#0061FE" />
            <path d="M8 10L14 7L20 10V18L14 21L8 18V10Z" stroke="white" strokeWidth="1.5" fill="none" />
            <path d="M14 7V21" stroke="white" strokeWidth="1.5" />
            <path d="M8 10L20 18" stroke="white" strokeWidth="1.5" opacity="0.5" />
            <path d="M20 10L8 18" stroke="white" strokeWidth="1.5" opacity="0.5" />
          </svg>
          tunelo
        </a>
        <div className="flex items-center gap-6">
          <a href="#features" className="text-sm text-[var(--tunelo-gray-400)] hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm text-[var(--tunelo-gray-400)] hover:text-white transition-colors">How It Works</a>
          <a href="#skill" className="text-sm text-[var(--tunelo-gray-400)] hover:text-white transition-colors">AI Skill</a>
          <a
            href="https://github.com/tunelo/tunelo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--tunelo-gray-400)] hover:text-white transition-colors flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--tunelo-gray-700)] bg-[var(--tunelo-gray-900)] text-xs text-[var(--tunelo-gray-400)] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--tunelo-green)] animate-pulse" />
          Open source · 1,165 lines of Rust
        </div>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
          Expose localhost
          <br />
          <span className="bg-gradient-to-r from-[var(--tunelo-blue)] via-[var(--tunelo-cyan)] to-[var(--tunelo-purple)] bg-clip-text text-transparent">
            to the internet
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-[var(--tunelo-gray-400)] max-w-2xl mx-auto mb-12 leading-relaxed">
          One command. Public HTTPS URL. Share your local dev server,
          demo an app, or give someone temporary access — through a
          fast QUIC tunnel.
        </p>

        {/* Terminal demo */}
        <div className="max-w-xl mx-auto glow">
          <div className="terminal">
            <div className="terminal-header">
              <div className="terminal-dot" style={{ background: "#ff5f57" }} />
              <div className="terminal-dot" style={{ background: "#febc2e" }} />
              <div className="terminal-dot" style={{ background: "#28c840" }} />
              <span className="ml-2 text-xs text-[var(--tunelo-gray-500)]">Terminal</span>
            </div>
            <div className="terminal-body text-left">
              <div>
                <span className="prompt">$ </span>
                <span className="command">tunelo http 3000</span>
              </div>
              <div className="mt-2">
                <span className="success">  ✔ </span>
                <span className="output">Tunnel is ready!</span>
              </div>
              <div className="mt-3">
                <span className="dim">  Public URL:  </span>
                <span className="url">https://abc123.tunelo.net</span>
              </div>
              <div>
                <span className="dim">  Forwarding:  </span>
                <span className="output">→ http://localhost:3000</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: "⚡",
      title: "One Command",
      desc: "No config files, no signup, no dashboard. Just tunelo http <port> and you're live.",
    },
    {
      icon: "🔒",
      title: "HTTPS by Default",
      desc: "TLS terminated at the gateway. Every tunnel gets a public HTTPS URL automatically.",
    },
    {
      icon: "🚀",
      title: "QUIC Tunnel",
      desc: "Multiplexed, encrypted, low-latency. Zero-copy data plane with ~14% overhead vs direct.",
    },
    {
      icon: "🦀",
      title: "Tiny & Fast",
      desc: "3.5 MB binary. 8 MB memory. Built in Rust with tokio + quinn. No garbage collector.",
    },
    {
      icon: "🌐",
      title: "Custom Subdomains",
      desc: "Request a specific subdomain like myapp.tunelo.net. First-come, first-served.",
    },
    {
      icon: "🤖",
      title: "AI Agent Ready",
      desc: "Comes with a SKILL.md that teaches any AI coding agent how to use tunelo in one step.",
    },
  ];

  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 tracking-tight">
          Why tunelo?
        </h2>
        <p className="text-[var(--tunelo-gray-400)] text-center mb-16 max-w-lg mx-auto">
          Built for developers who want to expose a local service
          without the overhead.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-xl border border-[var(--tunelo-gray-800)] bg-[var(--tunelo-gray-900)]/50 hover:border-[var(--tunelo-gray-700)] transition-colors"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--tunelo-gray-400)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 border-t border-[var(--tunelo-gray-800)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 tracking-tight">
          How it works
        </h2>
        <p className="text-[var(--tunelo-gray-400)] text-center mb-16 max-w-lg mx-auto">
          A single QUIC connection. No HTTP parsing on the data path.
          Just bytes flowing through.
        </p>

        {/* Architecture diagram */}
        <div className="terminal mb-12">
          <div className="terminal-header">
            <div className="terminal-dot" style={{ background: "#ff5f57" }} />
            <div className="terminal-dot" style={{ background: "#febc2e" }} />
            <div className="terminal-dot" style={{ background: "#28c840" }} />
            <span className="ml-2 text-xs text-[var(--tunelo-gray-500)]">Architecture</span>
          </div>
          <div className="terminal-body text-sm">
            <pre className="text-[var(--tunelo-gray-300)] leading-relaxed">{`Browser → HTTPS → Gateway → QUIC stream → Client → localhost:3000
                  (8 MB)                   (8 MB)

┌─────────┐    ┌─────────────────┐    ┌──────────────┐    ┌───────────┐
│ Browser  │───▶│  tunelo gateway │◀───│ tunelo client │───▶│ localhost │
│          │    │  TLS + routing  │    │  QUIC tunnel  │    │   :3000   │
└─────────┘    └─────────────────┘    └──────────────┘    └───────────┘
  Internet          Your VPS            Your machine        Your app`}</pre>
          </div>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: "1", title: "You run tunelo", desc: "Client opens a QUIC connection to the gateway and registers a subdomain." },
            { step: "2", title: "Gateway assigns URL", desc: "You get a public URL like abc123.tunelo.net. Traffic flows through the tunnel." },
            { step: "3", title: "Browsers connect", desc: "Requests hit the gateway, relay through QUIC, and reach your localhost. Zero-copy." },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-10 h-10 rounded-full bg-[var(--tunelo-blue)] text-white font-bold flex items-center justify-center mx-auto mb-4">
                {s.step}
              </div>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-[var(--tunelo-gray-400)] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Performance() {
  const stats = [
    { label: "Gateway memory", value: "8 MB" },
    { label: "Binary size", value: "3.5 MB" },
    { label: "Tunnel overhead", value: "~14%" },
    { label: "Throughput", value: "670 req/s" },
    { label: "Lines of Rust", value: "1,165" },
    { label: "Source files", value: "9" },
  ];

  return (
    <section className="py-24 px-6 border-t border-[var(--tunelo-gray-800)]">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">
          Small, fast, reliable
        </h2>
        <p className="text-[var(--tunelo-gray-400)] mb-16 max-w-lg mx-auto">
          Measured on localhost. Zero errors under 5,000 request stress test.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-bold bg-gradient-to-r from-[var(--tunelo-cyan)] to-[var(--tunelo-blue)] bg-clip-text text-transparent">
                {s.value}
              </div>
              <div className="text-sm text-[var(--tunelo-gray-500)] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SkillSection() {
  const [copied, setCopied] = useState(false);
  const [copiedSkill, setCopiedSkill] = useState(false);

  const copyInstall = () => {
    navigator.clipboard.writeText(SKILL_INSTALL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copySkill = () => {
    navigator.clipboard.writeText(SKILL_MD);
    setCopiedSkill(true);
    setTimeout(() => setCopiedSkill(false), 2000);
  };

  return (
    <section id="skill" className="py-24 px-6 border-t border-[var(--tunelo-gray-800)]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--tunelo-purple)]/30 bg-[var(--tunelo-purple)]/10 text-xs text-[var(--tunelo-purple)] mb-6">
            🤖 For AI Agents
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">
            Teach your agent in one command
          </h2>
          <p className="text-[var(--tunelo-gray-400)] max-w-xl mx-auto leading-relaxed">
            Add the tunelo skill to your AI coding agent. It learns the CLI,
            knows when to use tunnels, and handles the setup automatically.
          </p>
        </div>

        {/* Install skill command */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--tunelo-gray-300)]">Add skill to your agent</span>
            <button
              onClick={copyInstall}
              className="text-xs text-[var(--tunelo-gray-500)] hover:text-white transition-colors flex items-center gap-1"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <div className="terminal">
            <div className="terminal-body !py-4">
              <span className="prompt">$ </span>
              <span className="command">{SKILL_INSTALL}</span>
            </div>
          </div>
        </div>

        {/* Skill content */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--tunelo-gray-300)]">SKILL.md</span>
            <button
              onClick={copySkill}
              className="text-xs text-[var(--tunelo-gray-500)] hover:text-white transition-colors flex items-center gap-1"
            >
              {copiedSkill ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <div className="skill-block">
            <pre className="!text-[13px]">
              <code>
                {SKILL_MD.split("\n").map((line, i) => {
                  if (line.startsWith("#"))
                    return <span key={i}><span className="text-[var(--tunelo-cyan)]">{line}</span>{"\n"}</span>;
                  if (line.startsWith("tunelo") || line.startsWith("curl") || line.startsWith("cargo"))
                    return <span key={i}><span className="text-[var(--tunelo-green)]">{line}</span>{"\n"}</span>;
                  return <span key={i}><span className="text-[var(--tunelo-gray-500)]">{line}</span>{"\n"}</span>;
                })}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickStart() {
  return (
    <section className="py-24 px-6 border-t border-[var(--tunelo-gray-800)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16 tracking-tight">
          Get started
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Terminal 1 */}
          <div>
            <span className="text-xs text-[var(--tunelo-gray-500)] mb-2 block">1. Start your local service</span>
            <div className="terminal">
              <div className="terminal-header">
                <div className="terminal-dot" style={{ background: "#ff5f57" }} />
                <div className="terminal-dot" style={{ background: "#febc2e" }} />
                <div className="terminal-dot" style={{ background: "#28c840" }} />
              </div>
              <div className="terminal-body">
                <div><span className="prompt">$ </span><span className="command">python3 -m http.server 3000</span></div>
                <div className="output mt-1">Serving HTTP on 0.0.0.0 port 3000 ...</div>
              </div>
            </div>
          </div>
          {/* Terminal 2 */}
          <div>
            <span className="text-xs text-[var(--tunelo-gray-500)] mb-2 block">2. Expose it</span>
            <div className="terminal">
              <div className="terminal-header">
                <div className="terminal-dot" style={{ background: "#ff5f57" }} />
                <div className="terminal-dot" style={{ background: "#febc2e" }} />
                <div className="terminal-dot" style={{ background: "#28c840" }} />
              </div>
              <div className="terminal-body">
                <div><span className="prompt">$ </span><span className="command">tunelo http 3000</span></div>
                <div className="mt-2"><span className="success">  ✔ </span><span className="output">Tunnel is ready!</span></div>
                <div className="mt-2"><span className="dim">  URL: </span><span className="url">https://abc123.tunelo.net</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CLI() {
  return (
    <section className="py-24 px-6 border-t border-[var(--tunelo-gray-800)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4 tracking-tight">
          CLI Reference
        </h2>
        <p className="text-[var(--tunelo-gray-400)] text-center mb-16 max-w-lg mx-auto">
          Everything you need. Nothing you don't.
        </p>
        <div className="terminal">
          <div className="terminal-header">
            <div className="terminal-dot" style={{ background: "#ff5f57" }} />
            <div className="terminal-dot" style={{ background: "#febc2e" }} />
            <div className="terminal-dot" style={{ background: "#28c840" }} />
            <span className="ml-2 text-xs text-[var(--tunelo-gray-500)]">CLI</span>
          </div>
          <div className="terminal-body text-sm leading-loose">
            <pre>{`# Client
tunelo http <PORT>                          # Expose HTTP service
tunelo http <PORT> --subdomain myapp        # Request specific subdomain
tunelo http <PORT> --gateway host:4433      # Custom gateway
tunelo http <PORT> -H 0.0.0.0              # Forward to non-localhost

# Self-hosted gateway
tunelo-gateway                              # Start with defaults
tunelo-gateway --domain tunelo.net          # Production domain
tunelo-gateway --tunnel-addr 0.0.0.0:4433   # QUIC listener
tunelo-gateway --http-addr 0.0.0.0:80       # HTTP listener`}</pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-[var(--tunelo-gray-800)]">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-[var(--tunelo-gray-500)]">
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#0061FE" />
            <path d="M8 10L14 7L20 10V18L14 21L8 18V10Z" stroke="white" strokeWidth="1.5" fill="none" />
            <path d="M14 7V21" stroke="white" strokeWidth="1.5" />
          </svg>
          tunelo — MIT License
        </div>
        <div className="flex items-center gap-6 text-sm text-[var(--tunelo-gray-500)]">
          <a href="https://github.com/tunelo/tunelo" className="hover:text-white transition-colors" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="#skill" className="hover:text-white transition-colors">
            Skill
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <Performance />
      <QuickStart />
      <CLI />
      <SkillSection />
      <Footer />
    </>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { CostCounter } from "./cost-counter";

type IconName = "document" | "report" | "essay" | "short" | "quiz" | "viva";

const ALLOWED_EMAILS = new Set([
  "j.c.catling@bham.ac.uk",
  "a.z.brzozowski@bham.ac.uk",
  "f.s.julal@bham.ac.uk",
]);

const ACCESS_KEY = "ai-teaching-dashboard-email";

type Tool = {
  name: string;
  description: string;
  category: string;
  href: string;
  icon: IconName;
  number: string;
  internal?: boolean;
};

const tools: Tool[] = [
  {
    name: "Essay Feedback AI",
    description: "Review an essay and receive focused, constructive academic feedback.",
    category: "Written feedback",
    href: "/essay-feedback",
    icon: "document",
    number: "01",
    internal: true,
  },
  {
    name: "Report Feedback AI",
    description: "Upload a research report for clear, actionable feedback and guidance.",
    category: "Written feedback",
    href: "/report-feedback",
    icon: "report",
    number: "02",
    internal: true,
  },
  {
    name: "Essay Question AI",
    description: "Turn teaching materials into challenging essay questions for students.",
    category: "Question generator",
    href: "/essay-question",
    icon: "essay",
    number: "03",
    internal: true,
  },
  {
    name: "Short Answer Question AI",
    description: "Create focused questions designed for concise 150-word answers.",
    category: "Question generator",
    href: "/short-answer",
    icon: "short",
    number: "04",
    internal: true,
  },
  {
    name: "Lecture Quiz AI",
    description: "Generate ready-to-use multiple-choice quizzes from lecture files.",
    category: "Question generator",
    href: "/lecture-quiz",
    icon: "quiz",
    number: "06",
    internal: true,
  },
  {
    name: "Viva Check",
    description: "Support and review viva preparation through a dedicated private pilot.",
    category: "Viva preparation",
    href: "https://vivacheck-private-pilot.brzozoaz.chatgpt.site/login",
    icon: "viva",
    number: "07",
  },
];

function ToolIcon({ name }: { name: IconName }) {
  if (name === "quiz") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 7h11M8 12h11M8 17h7M4.5 7h.01M4.5 12h.01M4.5 17h.01" />
      </svg>
    );
  }

  if (name === "viva") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M5.5 20c.9-2.8 3.1-4.2 6.5-4.2s5.6 1.4 6.5 4.2M4 9.5V7.7M20 9.5V7.7" />
      </svg>
    );
  }

  if (name === "short") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 4h9l3 3v13H6zM15 4v4h3M9 12h6M9 16h4" />
      </svg>
    );
  }

  if (name === "essay") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 19 1-4L16.4 4.6a2 2 0 0 1 2.8 2.8L8.8 17.8 5 19ZM14.5 6.5l3 3M6 15l3 3" />
      </svg>
    );
  }

  if (name === "report") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 20V5h14v15zM9 16v-3M12 16V9M15 16v-5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h9l3 3v15H6zM15 3v4h3M9 11h6M9 15h6M9 19h4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedEmail = window.sessionStorage.getItem(ACCESS_KEY)?.toLowerCase() ?? "";
      if (ALLOWED_EMAILS.has(storedEmail)) setSignedInEmail(storedEmail);
      setIsChecking(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalisedEmail = email.trim().toLowerCase();

    if (!ALLOWED_EMAILS.has(normalisedEmail)) {
      setError("This email address does not have access to the dashboard.");
      return;
    }

    window.sessionStorage.setItem(ACCESS_KEY, normalisedEmail);
    setSignedInEmail(normalisedEmail);
    setError("");
  }

  function handleLogout() {
    window.sessionStorage.removeItem(ACCESS_KEY);
    setSignedInEmail(null);
    setEmail("");
    setError("");
  }

  if (isChecking) {
    return <main className="login-page" aria-busy="true" />;
  }

  if (!signedInEmail) {
    return (
      <main className="login-page">
        <div className="login-orb login-orb-one" aria-hidden="true" />
        <div className="login-orb login-orb-two" aria-hidden="true" />
        <section className="login-card" aria-labelledby="login-title">
          <div className="brand login-brand">
            <span className="brand-mark">A</span>
            <span>AI Teaching Tools</span>
          </div>
          <p className="eyebrow login-eyebrow"><span /> Secure dashboard</p>
          <h1 id="login-title" className="login-title">Welcome back.</h1>
          <p className="login-copy">
            Enter your authorised University of Birmingham email address to continue.
          </p>
          <form className="login-form" onSubmit={handleLogin} noValidate>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError("");
              }}
              placeholder="name@bham.ac.uk"
              aria-describedby={error ? "login-error" : undefined}
              aria-invalid={Boolean(error)}
              required
              autoFocus
            />
            {error && <p className="login-error" id="login-error" role="alert">{error}</p>}
            <button type="submit">Access dashboard <span aria-hidden="true">→</span></button>
          </form>
          <p className="login-note">Access is restricted to approved users.</p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="AI Teaching Tools home">
          <span className="brand-mark">A</span>
          <span>AI Teaching Tools</span>
        </a>
        <div className="header-actions"><CostCounter email={signedInEmail} /><button className="logout-button" type="button" onClick={handleLogout}>Sign out</button></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-orb hero-orb-left" aria-hidden="true" />
        <div className="hero-orb hero-orb-right" aria-hidden="true" />
        <div className="hero-content">
          <p className="eyebrow"><span /> Your teaching toolkit</p>
          <h1>
            Everything you need,
            <em> all in one place.</em>
          </h1>
          <p className="hero-copy">
            One simple dashboard for creating questions, reviewing academic work
            and supporting assessment.
          </p>
          <a className="hero-link" href="#tools">
            Explore your tools <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <section className="tools-section" id="tools" aria-labelledby="tools-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span /> Tool library</p>
            <h2 id="tools-title">Choose where to begin.</h2>
          </div>
          <p>
            Select any tool below. The integrated sub-apps run within this App;
            Viva Check remains available through its external link.
          </p>
        </div>

        <div className="tool-grid">
          {tools.map((tool) => (
            <a
              className="tool-card"
              href={tool.href}
              target={tool.internal ? undefined : "_blank"}
              rel={tool.internal ? undefined : "noreferrer"}
              key={tool.name}
              aria-label={tool.internal ? `Open ${tool.name}` : `Open ${tool.name} in a new tab`}
            >
              <div className="card-topline">
                <span>{tool.category}</span>
                <span className="card-number">{tool.number}</span>
              </div>
              <div className="icon-wrap"><ToolIcon name={tool.icon} /></div>
              <h3>{tool.name}</h3>
              <p>{tool.description}</p>
              <span className="open-link">
                Open tool <span className="arrow"><ArrowIcon /></span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark">A</span>
          <span>AI Teaching Tools</span>
        </div>
        <p>Academic tools designed to make teaching and feedback simpler.</p>
      </footer>
    </main>
  );
}

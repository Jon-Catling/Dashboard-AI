"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COUNTER_URLS = [
  "https://essay-feedback-ai.utah1974.chatgpt.site/api/dashboard-token-usage",
  "https://report-feedback-ai.utah1974.chatgpt.site/api/dashboard-token-usage",
  "https://essay-question-ai.utah1974.chatgpt.site/api/dashboard-token-usage",
  "https://short-answer-question-ai.utah1974.chatgpt.site/api/dashboard-token-usage",
  "https://lecture-quiz-ai.utah1974.chatgpt.site/api/dashboard-token-usage",
] as const;

const pence = (tokens: number) => ((tokens / 1_000_000) * 60).toFixed(2);

async function readCounter(url: string, email: string, signal: AbortSignal) {
  const response = await fetch(`${url}?email=${encodeURIComponent(email)}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Counter unavailable");
  const data = await response.json() as { totalTokens?: unknown };
  const total = Number(data.totalTokens);
  if (!Number.isFinite(total) || total < 0) throw new Error("Invalid counter total");
  return Math.round(total);
}

export function CostCounter({ email }: { email: string }) {
  const [total, setTotal] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const activeRequest = useRef(false);

  const refresh = useCallback(async () => {
    if (activeRequest.current) return;
    activeRequest.current = true;
    setRefreshing(true);
    setUnavailable(false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const totals = await Promise.all(
        COUNTER_URLS.map((url) => readCounter(url, email, controller.signal)),
      );
      setTotal(totals.reduce((sum, value) => sum + value, 0));
    } catch {
      setUnavailable(true);
    } finally {
      window.clearTimeout(timeout);
      activeRequest.current = false;
      setRefreshing(false);
    }
  }, [email]);

  useEffect(() => {
    void refresh();
    const handleFocus = () => { void refresh(); };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refresh]);

  return (
    <div className="cost-controls">
      <span className="cost-counter" aria-live="polite">
        Cumulative API cost: <strong>{total === null ? "—" : `${pence(total)}p`}</strong>
        {unavailable && <span className="cost-warning"> temporarily unavailable</span>}
      </span>
      <button type="button" className="reset-cost" onClick={() => { void refresh(); }} disabled={refreshing}>
        {refreshing ? "Refreshing…" : "Refresh total"}
      </button>
    </div>
  );
}

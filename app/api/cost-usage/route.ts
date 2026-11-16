const ALLOWED_EMAILS = new Set([
  "j.c.catling@bham.ac.uk",
  "a.z.brzozowski@bham.ac.uk",
  "f.s.julal@bham.ac.uk",
]);

const COUNTER_SOURCES = [
  {
    name: "Essay Feedback AI",
    url: "https://essay-feedback-ai.utah1974.chatgpt.site/api/token-usage",
  },
  {
    name: "Report Feedback AI",
    url: "https://report-feedback-ai.utah1974.chatgpt.site/api/dashboard-token-usage",
  },
  {
    name: "Essay Question AI",
    url: "https://essay-question-ai.utah1974.chatgpt.site/api/token-usage",
  },
  {
    name: "Short Answer Question AI",
    url: "https://short-answer-question-ai.utah1974.chatgpt.site/api/dashboard-token-usage",
  },
  {
    name: "Lecture Quiz AI",
    url: "https://lecture-quiz-ai.utah1974.chatgpt.site/api/token-usage",
  },
] as const;

function normaliseEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function readCounter(source: (typeof COUNTER_SOURCES)[number], email: string) {
  const response = await fetch(
    `${source.url}?email=${encodeURIComponent(email)}`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`${source.name} returned ${response.status}.`);
  }

  const data = await response.json() as { totalTokens?: unknown };
  const totalTokens = Number(data.totalTokens);
  if (!Number.isFinite(totalTokens) || totalTokens < 0) {
    throw new Error(`${source.name} returned an invalid total.`);
  }

  return Math.round(totalTokens);
}

export async function GET(request: Request) {
  const email = normaliseEmail(new URL(request.url).searchParams.get("email"));
  if (!ALLOWED_EMAILS.has(email)) {
    return Response.json(
      { error: "Unauthorised email address." },
      { status: 403 },
    );
  }

  try {
    const totals = await Promise.all(
      COUNTER_SOURCES.map((source) => readCounter(source, email)),
    );

    return Response.json(
      { totalTokens: totals.reduce((sum, total) => sum + total, 0) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "The cumulative total is temporarily unavailable." },
      {
        status: 502,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}

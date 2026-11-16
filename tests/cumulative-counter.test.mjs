import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const expectedSources = [
  "https://essay-feedback-ai.utah1974.chatgpt.site/api/dashboard-token-usage",
  "https://report-feedback-ai.utah1974.chatgpt.site/api/dashboard-token-usage",
  "https://essay-question-ai.utah1974.chatgpt.site/api/dashboard-token-usage",
  "https://short-answer-question-ai.utah1974.chatgpt.site/api/dashboard-token-usage",
  "https://lecture-quiz-ai.utah1974.chatgpt.site/api/dashboard-token-usage",
];

test("dashboard browser reads all five dedicated read-only counter routes", async () => {
  const source = await readFile(new URL("../app/cost-counter.tsx", import.meta.url), "utf8");
  for (const url of expectedSources) assert.match(source, new RegExp(url.replaceAll(".", "\\.")));
  assert.match(source, /Promise\.all/);
  assert.match(source, /AbortController/);
  assert.doesNotMatch(source, /setInterval/);
  assert.doesNotMatch(source, /method:\s*["']POST["']/);
});

test("dashboard counter has no write method", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("counter-write", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/api/cost-usage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reset", email: "j.c.catling@bham.ac.uk" }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 405);
});

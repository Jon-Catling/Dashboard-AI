/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const integratedServices: Record<string, string> = {
  "essay-feedback": "https://essay-feedback-ai.utah1974.chatgpt.site",
  "report-feedback": "https://report-feedback-ai.utah1974.chatgpt.site",
  "short-answer": "https://short-answer-question-ai.utah1974.chatgpt.site",
  "essay-question": "https://essay-question-ai.utah1974.chatgpt.site",
  "lecture-quiz": "https://lecture-quiz-ai.utah1974.chatgpt.site",
};

function integratedTarget(url: URL) {
  const match = url.pathname.match(/^\/api\/integrated\/([^/]+)\/(.+)$/);
  if (!match) return null;
  const origin = integratedServices[match[1]];
  if (!origin) return null;
  return `${origin}/api/${match[2]}${url.search}`;
}

async function proxyIntegrated(request: Request, target: string) {
  const headers = new Headers();
  for (const name of ["accept", "content-type", "x-user-email"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const response = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
  });
  return new Response(response.body, { status: response.status, headers: response.headers });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const integrated = integratedTarget(url);
    if (integrated && (request.method === "GET" || request.method === "POST")) {
      try {
        return await proxyIntegrated(request, integrated);
      } catch {
        return Response.json({ error: "The sub-app service is temporarily unavailable." }, { status: 502 });
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;

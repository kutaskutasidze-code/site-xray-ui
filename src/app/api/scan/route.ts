import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.XRAY_API_URL || "https://site-xray-api.fly.dev";
const API_KEY = process.env.XRAY_API_KEY || "";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url, version = "v7", maxPages = 1 } = body;

  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return new Response(JSON.stringify({ error: "Invalid URL" }), {
      status: 400,
    });
  }

  // Proxy to Fly.io scan API
  const res = await fetch(`${API_URL}/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ url, version, maxPages }),
  });

  // Stream the response through
  return new Response(res.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

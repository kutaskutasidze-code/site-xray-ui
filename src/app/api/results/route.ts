import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.XRAY_API_URL || "https://site-xray-api.fly.dev";
const API_KEY = process.env.XRAY_API_KEY || "";

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/scans`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}

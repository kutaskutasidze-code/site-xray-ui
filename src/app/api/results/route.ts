import { exec } from "child_process";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const home = process.env.HOME || "/Users/macintoshi";
  const historyFile = `${home}/projects/site-xray/ui/.scan-history.json`;

  return new Promise<NextResponse>((resolve) => {
    exec(`cat "${historyFile}" 2>/dev/null || echo "[]"`, (_, stdout) => {
      try {
        const data = JSON.parse(stdout || "[]");
        resolve(NextResponse.json(data));
      } catch {
        resolve(NextResponse.json([]));
      }
    });
  });
}

import { exec } from "child_process";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { url, version = "v7", maxPages = 1 } = await req.json();

  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return new Response(JSON.stringify({ error: "Invalid URL" }), {
      status: 400,
    });
  }

  // Sanitize inputs
  const safeUrl = url.replace(/[^a-zA-Z0-9:/.@_-]/g, "");
  const safeVersion = version.replace(/[^a-z0-9]/g, "");
  const safePages = Math.min(20, Math.max(1, parseInt(String(maxPages)) || 1));

  const hostname = (() => {
    try {
      return new URL(safeUrl).hostname.replace(/^www\./, "");
    } catch {
      return "unknown";
    }
  })();
  const outDir = `/tmp/xray-${hostname}-${Date.now()}`;
  const scanId = `${hostname}-${Date.now()}`;
  const home = process.env.HOME || "/Users/macintoshi";

  const cmd = [
    `NODE_PATH=$(npm root -g)`,
    `node`,
    `"${home}/projects/site-xray/${safeVersion}-stable.js"`,
    `"${safeUrl}"`,
    `"${outDir}"`,
    `${safePages}`,
  ].join(" ");

  const historyFile = `${home}/projects/site-xray/ui/.scan-history.json`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      function send(data: Record<string, unknown>) {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        } catch {}
      }

      send({ type: "log", text: `Engine: ${safeVersion}-stable.js`, level: "info" });
      send({ type: "log", text: `Target: ${safeUrl}`, level: "accent" });
      send({ type: "log", text: `Output: ${outDir}`, level: "dim" });
      send({ type: "log", text: "", level: "dim" });

      const proc = exec(cmd, { timeout: 300000, maxBuffer: 10 * 1024 * 1024 });

      let lastLine = "";

      function handleOutput(data: string) {
        const lines = data.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === lastLine) continue;
          lastLine = trimmed;

          let level = "info";
          if (trimmed.includes("✅") || trimmed.includes("✓")) level = "success";
          else if (trimmed.includes("❌") || trimmed.includes("✗")) level = "error";
          else if (trimmed.includes("🔬") || trimmed.includes("🎨") || trimmed.includes("📦")) level = "accent";
          else if (trimmed.startsWith("     ")) level = "dim";

          send({ type: "log", text: trimmed, level });
        }
      }

      proc.stdout?.on("data", (d: Buffer) => handleOutput(d.toString()));
      proc.stderr?.on("data", (d: Buffer) => handleOutput(d.toString()));

      proc.on("close", (code) => {
        // Count output files
        const countCmd = `
          imgs=$(ls "${outDir}/images/" 2>/dev/null | wc -l | tr -d ' ');
          fonts=$(ls "${outDir}/fonts/" 2>/dev/null | wc -l | tr -d ' ');
          vids=$(ls "${outDir}/videos/" 2>/dev/null | wc -l | tr -d ' ');
          pages=$(ls "${outDir}/"*.html 2>/dev/null | wc -l | tr -d ' ');
          echo "$pages $imgs $fonts $vids"
        `;

        exec(countCmd, (_, stdout) => {
          const [pages, images, fonts, videos] = (stdout || "0 0 0 0")
            .trim()
            .split(/\s+/)
            .map(Number);

          const result = {
            id: scanId,
            url: safeUrl,
            version: safeVersion,
            timestamp: new Date().toISOString(),
            pages: pages || 0,
            images: images || 0,
            fonts: fonts || 0,
            videos: videos || 0,
            status: code === 0 ? "done" : "error",
            dir: outDir,
          };

          // Save to history
          const saveCmd = `
            history='[]';
            [ -f "${historyFile}" ] && history=$(cat "${historyFile}");
            echo "$history" | node -e "
              let d='';process.stdin.on('data',c=>d+=c);
              process.stdin.on('end',()=>{
                let h=[];try{h=JSON.parse(d)}catch{}
                h.unshift(${JSON.stringify(result).replace(/'/g, "\\'")});
                if(h.length>50)h.length=50;
                require('fs').writeFileSync('${historyFile}',JSON.stringify(h,null,2));
              })
            "
          `;
          exec(saveCmd, () => {
            send({
              type: "done",
              dir: outDir,
              stats: { pages, images, fonts, videos },
              code,
            });
            controller.close();
          });
        });
      });

      proc.on("error", (err) => {
        send({ type: "error", text: `Process error: ${err.message}` });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

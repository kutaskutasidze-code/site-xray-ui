"use client";

import { useState, useRef, useEffect } from "react";

type LogEntry = { text: string; type: "info" | "success" | "error" | "accent" | "dim" };
type ScanResult = {
  id: string;
  url: string;
  version: string;
  timestamp: string;
  pages: number;
  images: number;
  fonts: number;
  videos: number;
  status: "running" | "done" | "error";
  dir: string;
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState("v7");
  const [maxPages, setMaxPages] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [activeTab, setActiveTab] = useState<"scan" | "history">("scan");
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  async function loadHistory() {
    try {
      const res = await fetch("/api/results");
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch {}
  }

  function addLog(text: string, type: LogEntry["type"] = "info") {
    setLogs((prev) => [...prev, { text, type }]);
  }

  async function startScan() {
    if (!url.trim() || scanning) return;

    const cleanUrl = url.trim().replace(/\/$/, "");
    if (!cleanUrl.startsWith("http")) {
      addLog("URL must start with http:// or https://", "error");
      return;
    }

    setScanning(true);
    setLogs([]);
    addLog(`Site X-Ray ${version}`, "accent");
    addLog(`Target: ${cleanUrl}`, "info");
    addLog(`Max pages: ${maxPages}`, "info");
    addLog("", "dim");
    addLog("Starting scan...", "info");

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cleanUrl, version, maxPages }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        addLog("Failed to start scan stream", "error");
        setScanning(false);
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.type === "log") {
              addLog(event.text, event.level || "info");
            } else if (event.type === "done") {
              addLog("", "dim");
              addLog(`Scan complete`, "success");
              addLog(`Output: ${event.dir}`, "accent");
              if (event.stats) {
                addLog(
                  `${event.stats.pages} pages, ${event.stats.images} images, ${event.stats.fonts} fonts, ${event.stats.videos} videos`,
                  "success"
                );
              }
              loadHistory();
            } else if (event.type === "error") {
              addLog(event.text, "error");
            }
          } catch {
            if (line.trim()) addLog(line.trim(), "dim");
          }
        }
      }
    } catch (err) {
      addLog(`Scan failed: ${err}`, "error");
    }

    setScanning(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !scanning) startScan();
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-surface-2 border border-border flex items-center justify-center text-accent text-sm font-bold">
            X
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">
              Site X-Ray
            </h1>
            <p className="text-[10px] text-text-dim tracking-widest uppercase">
              Rendering pipeline cloner
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("scan")}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              activeTab === "scan"
                ? "bg-surface-2 text-text border border-border"
                : "text-text-muted hover:text-text"
            }`}
          >
            Scan
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              activeTab === "history"
                ? "bg-surface-2 text-text border border-border"
                : "text-text-muted hover:text-text"
            }`}
          >
            History
            {results.length > 0 && (
              <span className="ml-1.5 text-text-dim">{results.length}</span>
            )}
          </button>
        </div>
      </header>

      {activeTab === "scan" ? (
        <main className="flex-1 flex flex-col p-6 gap-4 max-w-3xl mx-auto w-full">
          {/* Input section */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://example.com"
                disabled={scanning}
                className="flex-1 px-3 py-2.5 text-sm bg-surface border border-border rounded-lg text-text placeholder:text-text-dim focus:outline-none focus:border-accent/50 disabled:opacity-50 font-mono"
              />
              <button
                onClick={startScan}
                disabled={scanning || !url.trim()}
                className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  scanning
                    ? "bg-surface-2 text-text-dim cursor-wait"
                    : "bg-accent text-bg hover:brightness-110 active:scale-[0.98]"
                } disabled:opacity-40`}
              >
                {scanning ? (
                  <span className="scanning">Scanning...</span>
                ) : (
                  "Scan"
                )}
              </button>
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-[11px] text-text-dim">Engine</label>
              <select
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                disabled={scanning}
                className="px-2 py-1 text-xs bg-surface border border-border rounded-md text-text-muted focus:outline-none focus:border-accent/50"
              >
                <option value="v7">v7 — Pattern Recognition</option>
                <option value="v6">v6 — Bundle Analysis</option>
                <option value="v5">v5 — Static Clone</option>
              </select>
              <label className="text-[11px] text-text-dim ml-2">Pages</label>
              <input
                type="number"
                min={1}
                max={20}
                value={maxPages}
                onChange={(e) =>
                  setMaxPages(Math.max(1, parseInt(e.target.value) || 1))
                }
                disabled={scanning}
                className="w-14 px-2 py-1 text-xs bg-surface border border-border rounded-md text-text-muted focus:outline-none focus:border-accent/50 text-center"
              />
            </div>
          </div>

          {/* Log output */}
          <div
            ref={logRef}
            className="flex-1 min-h-[400px] bg-surface border border-border rounded-lg p-4 overflow-y-auto"
          >
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-2">
                  <p className="text-text-dim text-xs">
                    Enter a URL and hit Scan
                  </p>
                  <p className="text-text-dim/50 text-[10px]">
                    Captures rendered DOM, computed CSS, bundle params, and
                    animation patterns
                  </p>
                </div>
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`log-line ${log.type} text-xs font-mono`}>
                  {log.text || "\u00A0"}
                </div>
              ))
            )}
          </div>

          {/* Version info */}
          <div className="flex gap-4 text-[10px] text-text-dim">
            <span>v5: DOM + CSS + Assets</span>
            <span>v6: + GSAP Bundle Analysis</span>
            <span>v7: + Universal Pattern Recognition</span>
          </div>
        </main>
      ) : (
        <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
          <div className="space-y-2">
            {results.length === 0 ? (
              <div className="text-center py-20 text-text-dim text-xs">
                No scans yet
              </div>
            ) : (
              results.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-4 py-3 bg-surface border border-border rounded-lg hover:border-border-hover transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{r.url}</p>
                    <p className="text-[10px] text-text-dim mt-0.5">
                      {r.version} &middot; {r.pages}p &middot; {r.images}img
                      &middot; {r.fonts}f &middot; {r.videos}vid &middot;{" "}
                      {new Date(r.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        r.status === "done"
                          ? "bg-success/10 text-success"
                          : r.status === "error"
                          ? "bg-error/10 text-error"
                          : "bg-warning/10 text-warning"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      )}
    </div>
  );
}

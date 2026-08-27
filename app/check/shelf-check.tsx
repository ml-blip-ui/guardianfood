"use client";

/**
 * A diagnostics page that asks the running app to load every shelf and reports
 * which ones came back empty.
 *
 * This exists because the shelves depend on hand-written Guardian tag paths
 * and on the Guardian honouring tag intersections (/tone/recipes+food/eggs).
 * Neither can be verified without network access to theguardian.com, so the
 * check runs from wherever the site is deployed.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { CheckCircle2, Copy, LoaderCircle, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALL_SHELVES, TABS, TAB_SHELVES, listingPath } from "@/lib/sources";
import type { Shelf } from "@/lib/sources";

const CONCURRENCY = 3;

type Row = {
  shelf: Shelf;
  tab: string;
  state: "waiting" | "checking" | "ok" | "thin" | "failed";
  articles: number;
  detail: string;
};

function tabLabel(shelf: Shelf) {
  for (const { key, label } of TABS) {
    if (TAB_SHELVES[key].some((entry) => entry.id === shelf.id)) return label;
  }
  return "";
}

function initialRows(): Row[] {
  return ALL_SHELVES.map((shelf) => ({
    shelf,
    tab: tabLabel(shelf),
    state: "waiting",
    articles: 0,
    detail: "",
  }));
}

export function ShelfCheck() {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const cancelled = useRef(false);

  const update = useCallback((id: string, patch: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.shelf.id === id ? { ...row, ...patch } : row)));
  }, []);

  const run = useCallback(async () => {
    cancelled.current = false;
    setRows(initialRows());
    setDone(false);
    setCopied(false);
    setRunning(true);

    const queue = [...ALL_SHELVES];
    async function worker() {
      while (queue.length && !cancelled.current) {
        const shelf = queue.shift();
        if (!shelf) return;
        update(shelf.id, { state: "checking" });
        try {
          const response = await fetch(`/api/feed?id=${encodeURIComponent(shelf.id)}&page=1`);
          const data = await response.json();
          if (!response.ok) {
            update(shelf.id, { state: "failed", detail: data.error ?? `HTTP ${response.status}` });
          } else {
            const articles = (data.items ?? []).length;
            update(shelf.id, {
              state: articles === 0 ? "failed" : articles < 5 ? "thin" : "ok",
              articles,
              detail: articles === 0 ? "loaded but no articles" : "",
            });
          }
        } catch (reason) {
          update(shelf.id, {
            state: "failed",
            detail: reason instanceof Error ? reason.message : "request failed",
          });
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
    setDone(true);
  }, [update]);

  const counts = useMemo(() => ({
    ok: rows.filter((r) => r.state === "ok").length,
    thin: rows.filter((r) => r.state === "thin").length,
    failed: rows.filter((r) => r.state === "failed").length,
    checked: rows.filter((r) => r.state !== "waiting" && r.state !== "checking").length,
  }), [rows]);

  const report = useMemo(() => {
    if (!done) return "";
    const line = (r: Row) =>
      `${r.shelf.name} [${r.tab}] — ${r.shelf.paths.map((p) => listingPath(p, r.shelf.recipesOnly)).join(" + ")}` +
      (r.detail ? ` — ${r.detail}` : ` — ${r.articles} articles`);
    const failed = rows.filter((r) => r.state === "failed");
    const thin = rows.filter((r) => r.state === "thin");
    return [
      `Shelf check — ${new Date().toISOString()}`,
      `${counts.ok} working, ${counts.thin} thin, ${counts.failed} failed, of ${rows.length} shelves`,
      "",
      failed.length ? `FAILED (${failed.length}):` : "FAILED: none",
      ...failed.map((r) => `  ${line(r)}`),
      "",
      thin.length ? `THIN — under 5 articles (${thin.length}):` : "THIN: none",
      ...thin.map((r) => `  ${line(r)}`),
    ].join("\n");
  }, [done, rows, counts]);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked — the textarea below is the fallback.
    }
  }

  const problems = rows.filter((r) => r.state === "failed" || r.state === "thin");

  return (
    <main className="site-shell check-page">
      <header className="masthead">
        <div>
          <p className="eyebrow">Diagnostics</p>
          <h1>Shelf check</h1>
        </div>
      </header>

      <p className="check-intro">
        Loads every shelf from the Guardian and reports which ones come back empty. Each shelf
        is one real request, so this takes a couple of minutes. Results are cached for half an
        hour, so a second run is much quicker.
      </p>

      <div className="check-actions">
        <Button onClick={run} disabled={running}>
          {running ? <LoaderCircle className="spin" /> : <Play />}
          {running ? `Checking… ${counts.checked} of ${rows.length}` : done ? "Run again" : `Check all ${rows.length} shelves`}
        </Button>
        {done ? (
          <Button variant="outline" onClick={copyReport}>
            <Copy /> {copied ? "Copied" : "Copy the report"}
          </Button>
        ) : null}
      </div>

      {counts.checked ? (
        <div className="check-summary">
          <span data-tone="ok"><CheckCircle2 /> {counts.ok} working</span>
          {counts.thin ? <span data-tone="thin">{counts.thin} thin</span> : null}
          {counts.failed ? <span data-tone="failed"><XCircle /> {counts.failed} failed</span> : null}
        </div>
      ) : null}

      {done ? (
        <>
          <h2 className="check-subhead">{problems.length ? "Send this back to Claude" : "Everything works"}</h2>
          <textarea className="check-report" readOnly value={report} rows={Math.min(24, report.split("\n").length + 1)} />
        </>
      ) : null}

      <h2 className="check-subhead">Every shelf</h2>
      <ol className="check-list">
        {rows.map((row) => (
          <li key={row.shelf.id} data-state={row.state}>
            <span className="check-state" aria-hidden="true">
              {row.state === "ok" || row.state === "thin" ? <CheckCircle2 /> : null}
              {row.state === "failed" ? <XCircle /> : null}
              {row.state === "checking" ? <LoaderCircle className="spin" /> : null}
            </span>
            <span className="check-name">
              {row.shelf.name}
              <small>{row.tab}</small>
            </span>
            <code>{row.shelf.paths.map((path) => listingPath(path, row.shelf.recipesOnly)).join("  +  ")}</code>
            <span className="check-result">
              {row.state === "waiting" ? "—" : null}
              {row.state === "checking" ? "checking" : null}
              {row.state === "ok" || row.state === "thin" ? `${row.articles} articles` : null}
              {row.state === "failed" ? row.detail || "failed" : null}
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}

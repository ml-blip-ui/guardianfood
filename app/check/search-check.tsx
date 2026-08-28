"use client";

/**
 * Checks that free-text ingredient search is actually working on whatever is
 * deployed.
 *
 * The index is a file baked into the build, so it can be missing in two
 * different ways: the crawl never ran, or it ran but the site has not been
 * rebuilt since. Both look identical from the outside — the search box simply
 * offers you Google. This tells the two apart, and then puts a fixed battery
 * of searches through the real API so the answer is measured rather than
 * assumed.
 *
 * The output is a plain-text report to paste back to Claude, who cannot reach
 * the deployed site.
 */

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, Copy, LoaderCircle, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Each term earns its place by testing something different. Keep the list
 * short — every row is a real request.
 */
const PROBES: { term: string; expect: "hits" | "nothing"; why: string }[] = [
  { term: "cauliflower", expect: "hits", why: "untagged ingredient — the case that started this" },
  { term: "walnuts", expect: "hits", why: "plural search, singular headline" },
  { term: "anchovies", expect: "hits", why: "-ies plural" },
  { term: "rhubarb", expect: "hits", why: "seasonal, and only ever in the headline" },
  { term: "eggs", expect: "hits", why: "the Guardian tags this one too" },
  { term: "chicken thighs", expect: "hits", why: "two words, both must match" },
  { term: "jerusalem artichoke", expect: "hits", why: "a rarer two-word ingredient" },
  { term: "qwrtzx", expect: "nothing", why: "nonsense — must find nothing, not junk" },
];

type Row = {
  term: string;
  expect: "hits" | "nothing";
  why: string;
  state: "waiting" | "checking" | "ok" | "wrong" | "failed";
  route: string;
  found: number;
  first: string;
  detail: string;
};

type Status = {
  count: number;
  builtAt: string;
  newest: string;
  oldest: string;
  withStandfirst: number;
  withImage: number;
};

function initialRows(): Row[] {
  return PROBES.map((probe) => ({
    ...probe,
    state: "waiting",
    route: "",
    found: 0,
    first: "",
    detail: "",
  }));
}

/** How stale the index is, in words, because a date alone means nothing. */
function ageOf(builtAt: string) {
  if (!builtAt) return "never built";
  const built = new Date(builtAt);
  if (Number.isNaN(built.getTime())) return "unreadable date";
  const days = Math.floor((Date.now() - built.getTime()) / 86_400_000);
  if (days <= 0) return "built today";
  if (days === 1) return "1 day old";
  return `${days} days old`;
}

export function SearchCheck() {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const update = useCallback((term: string, patch: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.term === term ? { ...row, ...patch } : row)));
  }, []);

  const run = useCallback(async () => {
    setRows(initialRows());
    setStatus(null);
    setStatusError("");
    setDone(false);
    setCopied(false);
    setRunning(true);

    try {
      const response = await fetch("/api/index", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setStatus(await response.json());
    } catch (reason) {
      setStatusError(reason instanceof Error ? reason.message : "could not read the index");
    }

    // One at a time. A miss falls through to the Guardian, and there is no
    // sense hammering them from a diagnostics page.
    for (const probe of PROBES) {
      update(probe.term, { state: "checking" });
      try {
        const response = await fetch(`/api/search/${encodeURIComponent(probe.term)}/1`);
        const data = await response.json();
        if (!response.ok) {
          update(probe.term, { state: "failed", detail: data.error ?? `HTTP ${response.status}` });
          continue;
        }
        const items = data.items ?? [];
        const found = data.found ?? items.length;
        const gotHits = items.length > 0;
        update(probe.term, {
          state: gotHits === (probe.expect === "hits") ? "ok" : "wrong",
          route: data.route ?? "?",
          found,
          first: items[0]?.title ?? "",
        });
      } catch (reason) {
        update(probe.term, {
          state: "failed",
          detail: reason instanceof Error ? reason.message : "request failed",
        });
      }
    }

    setRunning(false);
    setDone(true);
  }, [update]);

  const counts = useMemo(() => ({
    ok: rows.filter((r) => r.state === "ok").length,
    wrong: rows.filter((r) => r.state === "wrong").length,
    failed: rows.filter((r) => r.state === "failed").length,
    checked: rows.filter((r) => r.state !== "waiting" && r.state !== "checking").length,
    viaIndex: rows.filter((r) => r.route === "index").length,
  }), [rows]);

  /**
   * The one-line answer, in the order the failures actually matter: no index
   * at all beats a bad result, because everything downstream follows from it.
   */
  const verdict = useMemo(() => {
    if (statusError) return `Could not read the index: ${statusError}`;
    if (!status) return "";
    if (status.count === 0) {
      return "The index is EMPTY. Either the crawl has not run yet, or it has run but this build predates it — check the Actions tab, then redeploy.";
    }
    if (counts.viaIndex === 0) {
      return `The index holds ${status.count} recipes but answered none of these searches, which should not happen. Something is wrong between the index and the search route.`;
    }
    if (counts.failed || counts.wrong) {
      return `The index is working (${counts.viaIndex} of ${rows.length} searches answered from it) but ${counts.failed + counts.wrong} probe(s) did not do what they should.`;
    }
    return `Working. All ${rows.length} probes behaved, ${counts.viaIndex} answered straight from the index of ${status.count} recipes.`;
  }, [status, statusError, counts, rows.length]);

  const report = useMemo(() => {
    if (!done) return "";
    return [
      `Ingredient search check — ${new Date().toISOString()}`,
      "",
      verdict,
      "",
      "INDEX:",
      status
        ? [
            `  ${status.count} recipes, ${ageOf(status.builtAt)} (built ${status.builtAt || "never"})`,
            `  covering ${status.oldest || "—"} to ${status.newest || "—"}`,
            `  ${status.withStandfirst} with a standfirst, ${status.withImage} with an image`,
          ].join("\n")
        : `  unreadable — ${statusError}`,
      "",
      `PROBES (${counts.ok} as expected, ${counts.wrong} wrong, ${counts.failed} failed):`,
      ...rows.map((row) => {
        const head = `  ${row.state.toUpperCase().padEnd(8)}"${row.term}" — expected ${row.expect}`;
        const body =
          row.state === "failed"
            ? `got ${row.detail}`
            : row.state === "waiting" || row.state === "checking"
              ? "not run"
              : `got ${row.found} via ${row.route}`;
        const first = row.first ? `\n              top: ${row.first}` : "";
        return `${head}, ${body}${first}\n              (${row.why})`;
      }),
    ].join("\n");
  }, [done, rows, status, statusError, verdict, counts]);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked — the textarea below is the fallback.
    }
  }

  return (
    <>
      <h2 className="check-subhead">Ingredient search</h2>
      <p className="check-intro">
        Runs {PROBES.length} real searches and reports what came back, along with what the
        deployed build holds in its recipe index. Use this after a crawl or a deploy to confirm
        free-text search is genuinely working, rather than quietly falling back to Google.
      </p>

      <div className="check-actions">
        <Button onClick={run} disabled={running}>
          {running ? <LoaderCircle className="spin" /> : <Play />}
          {running ? `Searching… ${counts.checked} of ${rows.length}` : done ? "Run again" : "Check ingredient search"}
        </Button>
        {done ? (
          <Button variant="outline" onClick={copyReport}>
            <Copy /> {copied ? "Copied" : "Copy the report"}
          </Button>
        ) : null}
      </div>

      {status || statusError ? (
        <div className="check-summary">
          {status ? (
            <span data-tone={status.count ? "ok" : "failed"}>
              {status.count ? <CheckCircle2 /> : <XCircle />} {status.count.toLocaleString("en-GB")} recipes
              indexed, {ageOf(status.builtAt)}
            </span>
          ) : (
            <span data-tone="failed"><XCircle /> index unreadable</span>
          )}
          {counts.checked ? <span data-tone={counts.wrong || counts.failed ? "thin" : "ok"}>{counts.ok} of {counts.checked} as expected</span> : null}
        </div>
      ) : null}

      {done ? (
        <>
          <p className="check-intro">{verdict}</p>
          <h3 className="check-subhead">Send this back to Claude</h3>
          <textarea className="check-report" readOnly value={report} rows={18} />
        </>
      ) : null}

      <ol className="check-list">
        {rows.map((row) => (
          <li key={row.term} data-state={row.state === "wrong" ? "failed" : row.state}>
            <span className="check-state" aria-hidden="true">
              {row.state === "ok" ? <CheckCircle2 /> : null}
              {row.state === "wrong" || row.state === "failed" ? <XCircle /> : null}
              {row.state === "checking" ? <LoaderCircle className="spin" /> : null}
            </span>
            <span className="check-name">
              {row.term}
              <small>{row.why}</small>
            </span>
            <code>{row.first || (row.state === "ok" && row.expect === "nothing" ? "nothing, as it should" : "—")}</code>
            <span className="check-result">
              {row.state === "waiting" ? "—" : null}
              {row.state === "checking" ? "searching" : null}
              {row.state === "ok" || row.state === "wrong" ? `${row.found} via ${row.route}` : null}
              {row.state === "failed" ? row.detail || "failed" : null}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

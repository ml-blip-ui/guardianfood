"use client";

/**
 * Want-to-cook and cooked lists.
 *
 * Storage sits behind this module so the browser-local implementation here can
 * be swapped for Supabase without the UI changing.
 */

import { useCallback, useEffect, useState } from "react";

export type Status = "want" | "cooked";

export type Entry = {
  url: string;
  title: string;
  image: string;
  published: string;
  status: Status;
  /** 1–5, set once something has been cooked. */
  rating?: number;
  updatedAt: string;
};

export type Recipe = Pick<Entry, "url" | "title" | "image" | "published">;

const ENTRIES_KEY = "grf.entries";
const LEGACY_PEOPLE_KEY = "grf.people";
const LEGACY_CURRENT_KEY = "grf.person";

export const MAX_RATING = 5;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Blocked storage means this session simply does not remember.
  }
}

/**
 * Earlier versions kept a list per named person. Fold any of those into the
 * single list so nothing saved back then is lost.
 */
function migrateFromPeople(): Entry[] {
  const people = read<string[]>(LEGACY_PEOPLE_KEY, []);
  if (!people.length) return [];
  const merged = new Map<string, Entry>();
  for (const person of people) {
    for (const entry of read<Entry[]>(`grf.entries.${person}`, [])) {
      const existing = merged.get(entry.url);
      if (!existing || entry.updatedAt > existing.updatedAt) merged.set(entry.url, entry);
    }
  }
  const entries = [...merged.values()];
  if (entries.length) write(ENTRIES_KEY, entries);
  try {
    for (const person of people) window.localStorage.removeItem(`grf.entries.${person}`);
    window.localStorage.removeItem(LEGACY_PEOPLE_KEY);
    window.localStorage.removeItem(LEGACY_CURRENT_KEY);
  } catch {
    // Nothing to do if storage refuses; the merge above already happened.
  }
  return entries;
}

/** Cooked by rating, best at the top; want-to-cook by most recently added. */
export function sortEntries(entries: Entry[], status: Status) {
  const list = entries.filter((entry) => entry.status === status);
  if (status === "cooked") {
    return list.sort(
      (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.updatedAt.localeCompare(a.updatedAt),
    );
  }
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Plain text, one recipe per two lines, for pasting anywhere. */
export function exportText(entries: Entry[], status: Status) {
  const list = sortEntries(entries, status);
  const heading =
    status === "cooked" ? `Have cooked, best first (${list.length})` : `Want to cook (${list.length})`;
  const lines = list.map((entry) => {
    const stars = entry.rating
      ? `${"★".repeat(entry.rating)}${"☆".repeat(MAX_RATING - entry.rating)}  `
      : "";
    return `${stars}${entry.title}\n${entry.url}`;
  });
  return [heading, "", ...lines].join("\n");
}

/**
 * Read a list back from exported text.
 *
 * Deliberately forgiving: it looks for a URL line and treats the line above it
 * as the title, so a hand-edited or partly-mangled paste still works. Leading
 * stars mean it was cooked and carry the rating; otherwise the heading decides,
 * defaulting to want-to-cook.
 */
export function parseImport(text: string): Entry[] {
  const lines = text.split(/\r?\n/);
  const entries: Entry[] = [];
  const seen = new Set<string>();
  let headingStatus: Status = "want";
  const now = new Date().toISOString();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (/^have cooked/i.test(line)) headingStatus = "cooked";
    else if (/^want to cook/i.test(line)) headingStatus = "want";
    if (!/^https?:\/\//i.test(line)) continue;

    const url = line.split(/\s/)[0];
    if (seen.has(url)) continue;

    // Walk back to the nearest non-empty line for the title.
    let title = "";
    let stars = 0;
    for (let j = i - 1; j >= 0 && j > i - 4; j -= 1) {
      const candidate = lines[j].trim();
      if (!candidate || /^https?:\/\//i.test(candidate)) continue;
      const match = candidate.match(/^([★☆]+)?\s*(.*)$/);
      stars = (match?.[1]?.match(/★/g) ?? []).length;
      title = (match?.[2] ?? "").trim();
      break;
    }
    if (!title) continue;

    seen.add(url);
    entries.push({
      url,
      title,
      image: "",
      published: "",
      status: stars ? "cooked" : headingStatus,
      ...(stars ? { rating: Math.min(stars, MAX_RATING) } : {}),
      updatedAt: now,
    });
  }
  return entries;
}

/** Merge without clobbering: anything already saved keeps its own rating. */
export function mergeEntries(existing: Entry[], incoming: Entry[]) {
  const have = new Set(existing.map((entry) => entry.url));
  const added = incoming.filter((entry) => !have.has(entry.url));
  return { merged: [...existing, ...added], added: added.length, skipped: incoming.length - added.length };
}

export function useLists() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = read<Entry[]>(ENTRIES_KEY, []);
    setEntries(saved.length ? saved : migrateFromPeople());
    setReady(true);
  }, []);

  const save = useCallback((next: Entry[]) => {
    setEntries(next);
    write(ENTRIES_KEY, next);
  }, []);

  /** Toggle want-to-cook. Something already cooked keeps its rating. */
  const toggleWant = useCallback(
    (recipe: Recipe) => {
      const existing = entries.find((entry) => entry.url === recipe.url);
      if (existing?.status === "want") {
        save(entries.filter((entry) => entry.url !== recipe.url));
        return;
      }
      if (existing) return;
      save([...entries, { ...recipe, status: "want", updatedAt: new Date().toISOString() }]);
    },
    [entries, save],
  );

  /** Rating something marks it cooked. */
  const rate = useCallback(
    (recipe: Recipe, rating: number) => {
      const updated: Entry = {
        ...recipe,
        status: "cooked",
        rating,
        updatedAt: new Date().toISOString(),
      };
      save([...entries.filter((entry) => entry.url !== recipe.url), updated]);
    },
    [entries, save],
  );

  /** Take it off both lists — the way back from a mis-tapped star. */
  const clearEntry = useCallback(
    (url: string) => save(entries.filter((entry) => entry.url !== url)),
    [entries, save],
  );

  const entryFor = useCallback(
    (url: string) => entries.find((entry) => entry.url === url),
    [entries],
  );

  /** Bring in a list exported from another device. */
  const importText = useCallback(
    (text: string) => {
      const result = mergeEntries(entries, parseImport(text));
      if (result.added) save(result.merged);
      return { added: result.added, skipped: result.skipped };
    },
    [entries, save],
  );

  return { ready, entries, toggleWant, rate, clearEntry, entryFor, importText };
}

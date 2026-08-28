"use client";

/**
 * Per-person want-to-cook and cooked lists.
 *
 * Storage sits behind this module so the browser-local implementation here can
 * be swapped for Supabase without the UI changing. Everything is keyed by
 * person: each household profile keeps its own lists and its own ratings.
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

const PEOPLE_KEY = "grf.people";
const CURRENT_KEY = "grf.person";
const entriesKey = (person: string) => `grf.entries.${person}`;

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

/** Cooked first by rating, best at the top; want-to-cook by most recent. */
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
export function exportText(entries: Entry[], status: Status, person: string) {
  const list = sortEntries(entries, status);
  const heading =
    status === "cooked"
      ? `${person} — cooked, best first (${list.length})`
      : `${person} — want to cook (${list.length})`;
  const lines = list.map((entry) => {
    const stars = entry.rating ? `${"★".repeat(entry.rating)}${"☆".repeat(MAX_RATING - entry.rating)}  ` : "";
    return `${stars}${entry.title}\n${entry.url}`;
  });
  return [heading, "", ...lines].join("\n");
}

export function useLists() {
  const [people, setPeople] = useState<string[]>([]);
  const [person, setPerson] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = read<string[]>(PEOPLE_KEY, []);
    const current = read<string>(CURRENT_KEY, "");
    const active = saved.includes(current) ? current : (saved[0] ?? "");
    setPeople(saved);
    setPerson(active);
    setEntries(active ? read<Entry[]>(entriesKey(active), []) : []);
    setReady(true);
  }, []);

  const choosePerson = useCallback((name: string) => {
    setPerson(name);
    write(CURRENT_KEY, name);
    setEntries(read<Entry[]>(entriesKey(name), []));
  }, []);

  const addPerson = useCallback((rawName: string) => {
    const name = rawName.trim().slice(0, 24);
    if (!name) return;
    setPeople((current) => {
      if (current.some((entry) => entry.toLowerCase() === name.toLowerCase())) return current;
      const next = [...current, name];
      write(PEOPLE_KEY, next);
      return next;
    });
    setPerson((current) => {
      if (current) return current;
      write(CURRENT_KEY, name);
      return name;
    });
  }, []);

  const removePerson = useCallback((name: string) => {
    setPeople((current) => {
      const next = current.filter((entry) => entry !== name);
      write(PEOPLE_KEY, next);
      setPerson((active) => {
        if (active !== name) return active;
        const fallback = next[0] ?? "";
        write(CURRENT_KEY, fallback);
        setEntries(fallback ? read<Entry[]>(entriesKey(fallback), []) : []);
        return fallback;
      });
      return next;
    });
  }, []);

  const save = useCallback(
    (next: Entry[]) => {
      setEntries(next);
      if (person) write(entriesKey(person), next);
    },
    [person],
  );

  /** Toggle want-to-cook. Something already cooked keeps its rating. */
  const toggleWant = useCallback(
    (recipe: Recipe) => {
      const existing = entries.find((entry) => entry.url === recipe.url);
      if (existing?.status === "want") {
        save(entries.filter((entry) => entry.url !== recipe.url));
        return;
      }
      if (existing) return;
      save([
        ...entries,
        { ...recipe, status: "want", updatedAt: new Date().toISOString() },
      ]);
    },
    [entries, save],
  );

  /** Rate it: that marks it cooked. Rating it the same again clears it. */
  const rate = useCallback(
    (recipe: Recipe, rating: number) => {
      const existing = entries.find((entry) => entry.url === recipe.url);
      if (existing?.status === "cooked" && existing.rating === rating) {
        save(entries.filter((entry) => entry.url !== recipe.url));
        return;
      }
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

  const entryFor = useCallback(
    (url: string) => entries.find((entry) => entry.url === url),
    [entries],
  );

  return {
    ready,
    people,
    person,
    entries,
    choosePerson,
    addPerson,
    removePerson,
    toggleWant,
    rate,
    entryFor,
  };
}

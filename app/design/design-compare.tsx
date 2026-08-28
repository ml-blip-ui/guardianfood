"use client";

/**
 * A throwaway comparison page: the same recipes rendered four ways, so a type
 * pairing can be chosen by looking rather than by me guessing. Delete once the
 * decision is made.
 *
 * Real Guardian articles are pulled through the normal feed route so the
 * comparison is against real headlines, which vary in length in ways sample
 * text never does.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bookmark, Star } from "lucide-react";

type Item = { title: string; link: string; description: string; kicker: string; published: string; image: string };

const FALLBACK: Item[] = [
  {
    title: "Rachel Roddy’s recipe for cauliflower and pasta bake",
    link: "#", kicker: "A kitchen in Rome", published: "2026-08-01T00:00:00.000Z", image: "",
    description: "A gratin of sorts, and a good way through a glut of cauliflower.",
  },
  {
    title: "Meera Sodha’s vegan recipe for crispy tofu with black bean sauce",
    link: "#", kicker: "The new vegan", published: "2026-07-26T00:00:00.000Z", image: "",
    description: "Salty, sweet and quick enough for a weeknight.",
  },
  {
    title: "Felicity Cloake’s masterclass: how to make the perfect focaccia",
    link: "#", kicker: "Masterclass", published: "2026-07-19T00:00:00.000Z", image: "",
    description: "Dimpled, oily and worth the wait.",
  },
];

const VARIANTS = [
  { id: "current", name: "Current", note: "Georgia and Arial, as the app is today." },
  { id: "warm", name: "A · Warm", note: "Fraunces and Karla. The most character — a food-magazine feel." },
  { id: "editorial", name: "B · Editorial", note: "Source Serif 4 and Inter. Closest to today, properly chosen." },
  { id: "guardian", name: "C · Guardian-ish", note: "Newsreader and Inter. Reads like an extension of the paper." },
] as const;

const SIZES = [
  { id: "sm", label: "Small" },
  { id: "md", label: "Medium" },
  { id: "lg", label: "Large" },
] as const;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function Row({ item, variant }: { item: Item; variant: string }) {
  const stars = variant === "current" ? 0 : 4;
  return (
    <article className="d-row">
      <div className="d-main">
        <div className="d-meta">
          {item.kicker ? <span className="d-kicker">{item.kicker}</span> : null}
          {item.published ? <time>{formatDate(item.published)}</time> : null}
        </div>
        <h3>{item.title}</h3>
        {item.description ? <p>{item.description}</p> : null}
        <span className="d-read">Read on the Guardian <ArrowUpRight /></span>
        <div className="d-controls">
          <button type="button" className="d-want" data-on={variant !== "current"}>
            <Bookmark /> Want to cook
          </button>
          <span className="d-rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} data-on={n <= stars} />
            ))}
          </span>
        </div>
      </div>
      {item.image ? (
        <div className="d-image">
          {/* Guardian CDN images, same as the app. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
        </div>
      ) : (
        <div className="d-image d-image-empty" aria-hidden="true" />
      )}
    </article>
  );
}

export function DesignCompare() {
  const [items, setItems] = useState<Item[]>(FALLBACK);
  const [size, setSize] = useState<string>("md");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/feed/quick-and-easy/1")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const real = (data?.items ?? []).filter((item: Item) => item.title).slice(0, 3);
        if (real.length) setItems(real);
      })
      .catch(() => {
        // The fallback headlines are already on screen.
      })
      .finally(() => setLoaded(true));
  }, []);

  return (
    <>
      {/* Page-scoped on purpose: this comparison page is temporary, and the
          rest of the app should not pay for these fonts. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Karla:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,600&display=swap"
      />

      <main className="d-page">
        <header>
          <p className="d-eyebrow">Design directions</p>
          <h1>Pick a look</h1>
          <p className="d-intro">
            The same {loaded ? "" : "sample "}recipes, four ways. <strong>Current</strong> is the app as it
            stands. The other three each apply the same set of refinements — bigger images, a wider type
            scale, fewer shouty uppercase labels, a little depth on the buttons — and differ only in the
            typefaces. So the gap between Current and the rest shows the refinements; the gaps between A, B
            and C show the type.
          </p>
          <p className="d-intro">
            Scroll through and see which one you like. “That one, but bigger headlines” is a perfectly good
            answer.
          </p>
          <div className="d-sizes">
            <span>Image size</span>
            {SIZES.map((option) => (
              <button
                key={option.id}
                type="button"
                data-on={size === option.id}
                onClick={() => setSize(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        {VARIANTS.map((variant) => (
          <section key={variant.id} className={`d-variant v-${variant.id}`} data-size={size}>
            <div className="d-label">
              <h2>{variant.name}</h2>
              <p>{variant.note}</p>
            </div>
            <div className="d-rows">
              {items.map((item) => (
                <Row item={item} key={`${variant.id}-${item.link}-${item.title}`} variant={variant.id} />
              ))}
            </div>
          </section>
        ))}

        <footer className="d-foot">
          <p>A temporary page for choosing. It goes once the decision is made.</p>
          <Link href="/">Back to the app</Link>
        </footer>
      </main>
    </>
  );
}

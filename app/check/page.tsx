import { SearchCheck } from "./search-check";
import { ShelfCheck } from "./shelf-check";

export const metadata = {
  title: "Checks — Guardian Recipe Finder",
  description: "Checks ingredient search and every shelf against what is actually deployed.",
};

export default function CheckPage() {
  return (
    <main className="site-shell check-page">
      <header className="masthead">
        <div>
          <p className="eyebrow">Diagnostics</p>
          <h1>Checks</h1>
        </div>
      </header>

      {/* Search first: it is the quick one, and the one most worth knowing. */}
      <SearchCheck />
      <ShelfCheck />
    </main>
  );
}

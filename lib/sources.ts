/**
 * Every shelf the app can show, and the Guardian tag paths behind it.
 *
 * The API routes resolve a shelf by id and only ever fetch the paths listed
 * here, so the server can never be asked to fetch an arbitrary Guardian URL.
 */

export type Shelf = {
  id: string;
  name: string;
  group: string;
  /** One or more Guardian tag paths. More than one is blended by date. */
  paths: string[];
  /**
   * Narrow the shelf to recipes by intersecting with the recipes tag.
   * Off for shelves where the non-recipe writing is the point (Feast,
   * Drinks, The Filter).
   */
  recipesOnly?: boolean;
  /** Group the results into weekly issues rather than a flat feed. */
  weekly?: boolean;
  /** Shown under the shelf name in the feed heading. */
  note?: string;
};

export type TabKey = "start" | "ingredients" | "cuisines" | "writers";

export const TABS: { key: TabKey; label: string }[] = [
  { key: "start", label: "Start here" },
  { key: "ingredients", label: "Ingredients" },
  { key: "cuisines", label: "Cuisines" },
  { key: "writers", label: "Writers" },
];

/**
 * The Guardian lets you intersect two tags with `+`, e.g.
 * /tone/recipes+food/eggs. That is what keeps the eggs shelf to recipes
 * instead of every article ever tagged eggs.
 *
 * If the Guardian ever stops honouring this, set this to false and every
 * shelf falls back to its plain tag.
 */
export const USE_TAG_INTERSECTION = true;
const RECIPES_TAG = "tone/recipes";

/** Turn a shelf path into the Guardian listing path to actually fetch. */
export function listingPath(path: string, recipesOnly: boolean | undefined) {
  if (!USE_TAG_INTERSECTION || recipesOnly === false) return path;
  if (path.includes("+")) return path;
  return `/${RECIPES_TAG}+${path.replace(/^\//, "")}`;
}

const food = (slug: string) => `/food/${slug}`;
const series = (slug: string) => `/food/series/${slug}`;

// ---------------------------------------------------------------- Start here

const START: Shelf[] = [
  {
    id: "all-recipes",
    name: "All Guardian recipes",
    group: "The main feeds",
    paths: ["/tone/recipes"],
    recipesOnly: false,
  },
  {
    id: "feast",
    name: "The Feast",
    group: "The main feeds",
    paths: ["/theguardian/feast"],
    recipesOnly: false,
    weekly: true,
    note: "Grouped into weekly issues, as it appears in print.",
  },
  { id: "quick-and-easy", name: "Quick and easy", group: "Weeknight cooking", paths: [series("quick-and-easy")] },
  { id: "30-minute", name: "30 minute meals", group: "Weeknight cooking", paths: [series("30-minute-recipes")] },
  { id: "budget", name: "Budget cooking", group: "Weeknight cooking", paths: [series("1-pound-meals")] },
  { id: "vegetarian", name: "Vegetarian", group: "Weeknight cooking", paths: [food("vegetarian")] },
  { id: "vegan", name: "Vegan", group: "Weeknight cooking", paths: [food("vegan")] },

  {
    id: "baking",
    name: "Baking & sweet things",
    group: "Bigger projects",
    paths: [
      food("baking"), food("bread"), food("cake"), food("biscuits"),
      food("pancakes"), food("pastry"), food("sourdough"),
    ],
  },
  {
    id: "drinks",
    name: "Drinks",
    group: "Bigger projects",
    paths: [
      food("wine"), food("cocktails"), food("spirits"), food("beer"),
      food("cider"), food("whisky"), food("coffee"), food("tea"),
    ],
    recipesOnly: false,
  },
  {
    id: "felicity-cloake-masterclass",
    name: "Felicity Cloake’s masterclass",
    group: "Bigger projects",
    paths: [series("felicity-cloake-s-masterclass")],
  },
];

// --------------------------------------------------------------- Ingredients

const INGREDIENTS: Shelf[] = [
  ["chicken", "Chicken"], ["eggs", "Eggs"], ["pasta", "Pasta"],
  ["rice", "Rice"], ["tofu", "Tofu"], ["noodles", "Noodles"],
].map(([slug, name]) => ({
  id: `ingredient-${slug}`,
  name,
  group: "In the fridge",
  paths: [food(slug)],
}));

// --------------------------------------------------- Cuisines & meal courses

const COURSES: Shelf[] = [
  ["main-course", "Main course"], ["breakfast", "Breakfast"], ["brunch", "Brunch"],
  ["soup", "Soup"], ["salad", "Salad"], ["side-dishes", "Side dishes"],
  ["snacks", "Snacks"], ["starter", "Starter"], ["dessert", "Dessert"],
].map(([slug, name]) => ({
  id: `course-${slug}`,
  name,
  group: "Meal type",
  paths: [food(slug)],
}));

const CUISINES: Shelf[] = [
  ["american-food-and-drink", "American"], ["australian-food-and-drink", "Australian"],
  ["british-food-and-drink", "British"], ["caribbean-food-and-drink", "Caribbean"],
  ["chinese", "Chinese"], ["french", "French"], ["german-food-and-drink", "German"],
  ["greek-food-and-drink", "Greek"], ["indian", "Indian"], ["irish-food-and-drink", "Irish"],
  ["italian-food-and-drink", "Italian"], ["japanese", "Japanese"],
  ["korean-food-and-drink", "Korean"], ["mexican", "Mexican"],
  ["middleeastern", "Middle Eastern"], ["portuguese", "Portuguese"],
  ["scandinavian", "Scandinavian"], ["spanish", "Spanish"], ["thai", "Thai"],
  ["turkish-food-and-drink", "Turkish"], ["vietnamese-food-and-drink", "Vietnamese"],
].map(([slug, name]) => ({
  id: `cuisine-${slug}`,
  name,
  group: "Around the world",
  paths: [food(slug)],
}));

const SEASONS: Shelf[] = [
  ["christmas-food-and-drink", "Christmas"], ["spring-food-and-drink", "Spring"],
  ["summer-food-and-drink", "Summer"], ["autumn-food-and-drink", "Autumn"],
  ["winter-food-and-drink", "Winter"],
].map(([slug, name]) => ({
  id: `season-${slug}`,
  name,
  group: "Seasons & celebrations",
  paths: [food(slug)],
}));

// ------------------------------------------------------ Writers & collections

/**
 * `recipesOnly` is off for the critics and drink writers. Narrowing a profile
 * to the recipes tag empties their shelves, because reviews and columns are
 * what they write — their shelf is the column, not a recipe list.
 */
const writer = (slug: string, name: string, group: string, recipesOnly = true): Shelf => ({
  id: `writer-${slug}`,
  name,
  group,
  paths: [`/profile/${slug}`],
  recipesOnly,
});

const WRITERS: Shelf[] = [
  ...[
    ["alice-zaslavsky", "Alice Zaslavsky"], ["anna-jones", "Anna Jones"],
    ["claire-thomson", "Claire Thomson"],
    ["felicity-cloake", "Felicity Cloake"], ["georgina-hayden", "Georgina Hayden"],
    ["hughfearnleywhittingstall", "Hugh Fearnley-Whittingstall"],
    ["itamar-srulovich", "Itamar Srulovich"], ["ixta-belfrage", "Ixta Belfrage"],
    ["jose-pizarro", "José Pizarro"], ["meera-sodha", "Meera Sodha"],
    ["nigella-lawson", "Nigella Lawson"], ["nigelslater", "Nigel Slater"],
    ["olia-hercules", "Olia Hercules"], ["rachel-roddy", "Rachel Roddy"],
    ["ravinder-bhogal", "Ravinder Bhogal"], ["romy-gill", "Romy Gill"],
    ["rukmini-iyer", "Rukmini Iyer"], ["sami-tamimi", "Sami Tamimi"],
    ["sarit-packer", "Sarit Packer"], ["tamal-ray", "Tamal Ray"],
    ["thomasina-miers", "Thomasina Miers"], ["tom-hunt", "Tom Hunt"],
    ["yotamottolenghi", "Yotam Ottolenghi"],
  ].map(([slug, name]) => writer(slug, name, "Cooks & recipe writers")),
  ...[
    ["benjamina-ebuehi", "Benjamina Ebuehi"], ["ravneet-gill", "Ravneet Gill"],
    ["ruby-tandoh", "Ruby Tandoh"],
    ["claireptak", "Claire Ptak"], ["danlepard", "Dan Lepard"], ["philip-khoury", "Philip Khoury"],
    ["kim-joy", "Kim-Joy"],
  ].map(([slug, name]) => writer(slug, name, "Baking & desserts")),
  ...[
    ["bee-wilson", "Bee Wilson"], ["gracedent", "Grace Dent"], ["jayrayner", "Jay Rayner"],
    ["jonathan-nunn", "Jonathan Nunn"], ["marina-oloughlin", "Marina O’Loughlin"],
    ["rachelcooke", "Rachel Cooke"], ["timhayward", "Tim Hayward"],
    ["timlewis", "Tim Lewis"], ["tonynaylor", "Tony Naylor"], ["zoewilliams", "Zoe Williams"],
  ].map(([slug, name]) => writer(slug, name, "Critics & food writers", false)),
  ...[
    ["david-williams", "David Williams"], ["fionabeckett", "Fiona Beckett"],
    ["hannah-crosbie", "Hannah Crosbie"], ["henry-jeffreys", "Henry Jeffreys"],
    ["richard-godwin", "Richard Godwin"],
  ].map(([slug, name]) => writer(slug, name, "Drink writers", false)),
];

const COLLECTIONS: Shelf[] = [
  { id: "nigel-slater-midweek", name: "Nigel Slater’s midweek dinner", group: "Recipe collections", paths: [series("nigel-slaters-midweek-dinner")] },
  { id: "the-new-vegan", name: "The new vegan", group: "Recipe collections", paths: [series("the-new-vegan")] },
  { id: "the-sweet-spot", name: "The sweet spot", group: "Recipe collections", paths: [series("the-sweet-spot")] },
  { id: "kitchen-in-rome", name: "A kitchen in Rome", group: "Recipe collections", paths: [series("a-kitchen-in-rome")] },
  { id: "jay-rayner-restaurants", name: "Jay Rayner on restaurants", group: "Recipe collections", paths: [series("jay-rayner-on-restaurants")], recipesOnly: false },
];

// ------------------------------------------------------------------- exports

export const TAB_SHELVES: Record<TabKey, Shelf[]> = {
  start: START,
  ingredients: INGREDIENTS,
  cuisines: [...COURSES, ...CUISINES, ...SEASONS],
  writers: [...WRITERS, ...COLLECTIONS],
};

export const ALL_SHELVES: Shelf[] = Object.values(TAB_SHELVES).flat();

const BY_ID = new Map(ALL_SHELVES.map((shelf) => [shelf.id, shelf]));

export function shelfById(id: string): Shelf | undefined {
  return BY_ID.get(id);
}

export function tabOf(id: string): TabKey {
  for (const { key } of TABS) {
    if (TAB_SHELVES[key].some((shelf) => shelf.id === id)) return key;
  }
  return "start";
}

export const DEFAULT_SHELF_ID = "quick-and-easy";

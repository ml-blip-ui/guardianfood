export type Source = {
  name: string;
  path: string;
  group: string;
};

const food = (name: string, slug: string, group: string): Source => ({
  name,
  path: `/food/${slug}`,
  group,
});

const series = (name: string, slug: string, group = "Recipe collections"): Source => ({
  name,
  path: `/food/series/${slug}`,
  group,
});

const profile = (name: string, slug: string, group: string): Source => ({
  name,
  path: `/profile/${slug}`,
  group,
});

export const topics: Source[] = [
  ...[
    ["Main course", "main-course"], ["Breakfast", "breakfast"], ["Brunch", "brunch"],
    ["Soup", "soup"], ["Salad", "salad"], ["Side dishes", "side-dishes"],
    ["Snacks", "snacks"], ["Starter", "starter"], ["Dessert", "dessert"],
  ].map(([name, slug]) => food(name, slug, "Meals & occasions")),
  ...[
    ["Baking", "baking"], ["Bread", "bread"], ["Cake", "cake"],
    ["Biscuits", "biscuits"], ["Pancakes", "pancakes"], ["Pastry", "pastry"],
    ["Sourdough", "sourdough"],
  ].map(([name, slug]) => food(name, slug, "Baking & sweet dishes")),
  ...[
    ["Pasta", "pasta"], ["Rice", "rice"], ["Noodles", "noodles"], ["Pizza", "pizza"],
    ["Sandwiches", "sandwiches"], ["Burgers", "burgers"], ["Curry", "curry"],
    ["Stew", "stew"], ["Barbecue", "barbecue"], ["Leftovers", "leftovers"],
    ["Polenta", "polenta"],
  ].map(([name, slug]) => food(name, slug, "Dishes & formats")),
  ...[
    ["Meat", "meat"], ["Chicken", "chicken"], ["Pork", "pork"], ["Beef", "beef"],
    ["Lamb", "lamb"], ["Duck", "duck"], ["Turkey", "turkey"], ["Game", "game"],
    ["Sausages", "sausages"],
  ].map(([name, slug]) => food(name, slug, "Meat & poultry")),
  ...[
    ["Fish", "fish"], ["Seafood", "seafood"], ["Shellfish", "shellfish"],
    ["Oysters", "oysters"], ["Eggs", "eggs"], ["Tofu", "tofu"],
  ].map(([name, slug]) => food(name, slug, "Fish & other proteins")),
  ...[
    ["Cheese", "cheese"], ["Milk", "milk"], ["Chocolate", "chocolate"],
    ["Ice-cream", "ice-cream"],
  ].map(([name, slug]) => food(name, slug, "Dairy & sweets")),
  ...[
    ["Vegetables", "vegetables"], ["Potatoes", "potatoes"], ["Tomatoes", "tomatoes"],
    ["Garlic", "garlic"], ["Pumpkin", "pumpkin"], ["Fruit", "fruit"],
  ].map(([name, slug]) => food(name, slug, "Vegetables & fruit")),
  ...[
    ["Vegetarian", "vegetarian"], ["Vegan", "vegan"],
    ["Gluten-free", "gluten-free"], ["Dairy-free", "dairy-free"],
  ].map(([name, slug]) => food(name, slug, "Dietary preferences")),
  ...[
    ["American", "american-food-and-drink"], ["Australian", "australian-food-and-drink"],
    ["British", "british-food-and-drink"], ["Caribbean", "caribbean-food-and-drink"],
    ["Chinese", "chinese"], ["French", "french"], ["German", "german-food-and-drink"],
    ["Greek", "greek-food-and-drink"], ["Indian", "indian"], ["Irish", "irish-food-and-drink"],
    ["Italian", "italian-food-and-drink"], ["Japanese", "japanese"],
    ["Korean", "korean-food-and-drink"], ["Mexican", "mexican"],
    ["Middle Eastern", "middleeastern"], ["Portuguese", "portuguese"],
    ["Scandinavian", "scandinavian"], ["Spanish", "spanish"], ["Thai", "thai"],
    ["Turkish", "turkish-food-and-drink"], ["Vietnamese", "vietnamese-food-and-drink"],
  ].map(([name, slug]) => food(name, slug, "Cuisines")),
  ...[
    ["Christmas", "christmas-food-and-drink"], ["Summer", "summer-food-and-drink"],
    ["Autumn", "autumn-food-and-drink"], ["Winter", "winter-food-and-drink"],
    ["Spring", "spring-food-and-drink"],
  ].map(([name, slug]) => food(name, slug, "Seasons & celebrations")),
  ...[
    ["Wine", "wine"], ["Cocktails", "cocktails"], ["Spirits", "spirits"],
    ["Beer", "beer"], ["Cider", "cider"], ["Whisky", "whisky"],
    ["Coffee", "coffee"], ["Tea", "tea"],
  ].map(([name, slug]) => food(name, slug, "Drinks")),
  food("Chefs", "chefs", "Food culture & places"),
  food("Restaurants", "restaurants", "Food culture & places"),
];

export const collections: Source[] = [
  { name: "All Guardian recipes", path: "/tone/recipes", group: "Main indexes" },
  { name: "Feast supplement", path: "/theguardian/feast", group: "Main indexes" },
  series("Quick and easy", "quick-and-easy", "Fast & practical"),
  series("30 minute recipes", "30-minute-recipes", "Fast & practical"),
  series("Budget meals", "1-pound-meals", "Fast & practical"),
  series("Quick and easy + pasta", "quick-and-easy+pasta", "Fast & practical"),
  series("Quick and easy + vegetarian", "quick-and-easy+vegetarian", "Fast & practical"),
  series("Quick and easy + chicken", "quick-and-easy+chicken", "Fast & practical"),
  series("Quick and easy + noodles", "quick-and-easy+noodles", "Fast & practical"),
  series("30 minute recipes + pasta", "30-minute-recipes+pasta", "Fast & practical"),
  series("30 minute recipes + vegetarian", "30-minute-recipes+vegetarian", "Fast & practical"),
  series("Felicity Cloake’s masterclass", "felicity-cloake-s-masterclass"),
  series("Nigel Slater’s midweek dinner", "nigel-slaters-midweek-dinner"),
  series("Jay Rayner on restaurants", "jay-rayner-on-restaurants"),
  series("The new vegan", "the-new-vegan"),
  series("The sweet spot", "the-sweet-spot"),
  series("A kitchen in Rome", "a-kitchen-in-rome"),
  { name: "Quick and easy RSS", path: "/food/series/quick-and-easy/rss", group: "RSS feeds" },
  { name: "30 minute recipes RSS", path: "/food/series/30-minute-recipes/rss", group: "RSS feeds" },
];

export const writers: Source[] = [
  ...[
    ["Alice Zaslavsky", "alice-zaslavsky"], ["Anna Jones", "anna-jones"],
    ["Chetna Makan", "chetna-makan"], ["Claire Thomson", "claire-thomson"],
    ["Felicity Cloake", "felicity-cloake"], ["Georgina Hayden", "georgina-hayden"],
    ["Hugh Fearnley-Whittingstall", "hughfearnleywhittingstall"],
    ["Itamar Srulovich", "itamar-srulovich"], ["Ixta Belfrage", "ixta-belfrage"],
    ["José Pizarro", "jose-pizarro"], ["Meera Sodha", "meera-sodha"],
    ["Nigella Lawson", "nigella-lawson"], ["Nigel Slater", "nigelslater"],
    ["Olia Hercules", "olia-hercules"], ["Rachel Roddy", "rachel-roddy"],
    ["Ravinder Bhogal", "ravinder-bhogal"], ["Romy Gill", "romy-gill"],
    ["Rukmini Iyer", "rukmini-iyer"], ["Sami Tamimi", "sami-tamimi"],
    ["Sarit Packer", "sarit-packer"], ["Tamal Ray", "tamal-ray"],
    ["Thomasina Miers", "thomasina-miers"], ["Tom Hunt", "tom-hunt"],
    ["Yotam Ottolenghi", "yotamottolenghi"],
  ].map(([name, slug]) => profile(name, slug, "Recipe writers & cooks")),
  ...[
    ["Benjamina Ebuehi", "benjamina-ebuehi"], ["Ravneet Gill", "ravneet-gill"],
    ["Edd Kimber", "edd-kimber"], ["Ruby Tandoh", "ruby-tandoh"],
    ["Claire Ptak", "claireptak"], ["Richard Bertinet", "richard-bertinet"],
    ["Dan Lepard", "danlepard"], ["Philip Khoury", "philip-khoury"], ["Kim-Joy", "kim-joy"],
  ].map(([name, slug]) => profile(name, slug, "Baking & desserts")),
  ...[
    ["Bee Wilson", "bee-wilson"], ["Grace Dent", "gracedent"], ["Jay Rayner", "jayrayner"],
    ["Jonathan Nunn", "jonathan-nunn"], ["Marina O’Loughlin", "marina-oloughlin"],
    ["Rachel Cooke", "rachelcooke"], ["Tim Hayward", "timhayward"],
    ["Tim Lewis", "timlewis"], ["Tony Naylor", "tonynaylor"], ["Zoe Williams", "zoewilliams"],
  ].map(([name, slug]) => profile(name, slug, "Critics & food journalists")),
  ...[
    ["David Williams", "david-williams"], ["Fiona Beckett", "fionabeckett"],
    ["Hannah Crosbie", "hannah-crosbie"], ["Henry Jeffreys", "henry-jeffreys"],
    ["Richard Godwin", "richard-godwin"],
  ].map(([name, slug]) => profile(name, slug, "Drink writers")),
];

export const SOURCE_COUNT = topics.length + collections.length + writers.length;

import { ShelfCheck } from "./shelf-check";

export const metadata = {
  title: "Shelf check — Guardian Recipe Finder",
  description: "Checks every shelf against the Guardian and reports which ones are broken.",
};

export default function CheckPage() {
  return <ShelfCheck />;
}

import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next ships eslintrc-style config, so it has to come through
// FlatCompat to be usable from a flat config file.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const eslintConfig = [
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["components/ui/**/*.{ts,tsx}"],
    rules: {
      // Vendored verbatim from the shadcn registry; keep the source intact.
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];

export default eslintConfig;

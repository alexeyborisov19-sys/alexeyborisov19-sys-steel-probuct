import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(import.meta.url);
const directory = dirname(filename);
const compat = new FlatCompat({ baseDirectory: directory });

export default defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "output/**",
    "public/**",
    "*.config.cjs",
    "next-env.d.ts",
  ]),
  {
    // The approved layout relies on art-directed crops and prepared AVIF/WebP
    // assets. Their loading behavior is measured separately with Lighthouse.
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
]);

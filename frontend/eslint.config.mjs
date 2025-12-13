import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Images come from external sources (Google avatars, runtime API)
      // that can't be optimized by Next.js Image at build time
      "@next/next/no-img-element": "off",
      // This rule is overly strict for derived state patterns like resetting
      // pagination when filters change or syncing form state with props
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/lib/api/**/*.gen.ts",
  ]),
]);

export default eslintConfig;

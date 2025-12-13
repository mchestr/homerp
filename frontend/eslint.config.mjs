import nextConfig from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextConfig,
  ...nextTypescript,
  {
    ignores: ["src/lib/api/**/*.gen.ts"],
  },
  {
    rules: {
      // Images come from external sources (Google avatars, runtime API)
      // that can't be optimized by Next.js Image at build time
      "@next/next/no-img-element": "off",
      // TODO: Fix these patterns properly in a follow-up PR
      // Many components use setState in effects for filter/form reset logic
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;

import tsx from "@cartercree/eslint-config/configs/tsx.js";

export default [
  ...tsx,
  {
    ignores: ["dist"],
  },
  {
    files: ["vite.config.ts"],
    rules: {
      "import/no-default-export": "off",
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/naming-convention": "off",
      eqeqeq: "off",
      "func-style": "off",
      "prefer-arrow/prefer-arrow-functions": "off",
      "react-refresh/only-export-components": "off",
    },
  },
];

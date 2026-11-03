import js from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import tseslint from "typescript-eslint";

const sourceFiles = ["src/**/*.{ts,tsx}", "scripts/**/*.ts", "vite.config.ts"];

const prettierOptions = {
  semi: true,
  singleQuote: false,
  printWidth: 120,
  trailingComma: "all",
  tabWidth: 2,
  endOfLine: "auto",
};

export default tseslint.config(
  {
    ignores: ["node_modules", "dist", "build", "coverage"],
  },
  {
    files: sourceFiles,
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslintPluginPrettierRecommended,
  {
    files: sourceFiles,
    rules: {
      semi: ["error", "always"],
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "no-irregular-whitespace": ["error", { skipTemplates: true }],
      "@typescript-eslint/no-namespace": "off",
      "no-console": ["error", { allow: ["debug", "error"] }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/prefer-readonly": "warn",
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        {
          accessibility: "explicit",
          overrides: { constructors: "no-public" },
        },
      ],
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "interface",
          format: ["PascalCase"],
          custom: {
            regex: "^I[A-Z]",
            match: true,
          },
        },
        {
          selector: "typeAlias",
          format: ["PascalCase"],
        },
        {
          selector: "enum",
          format: ["PascalCase"],
        },
      ],
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "prettier/prettier": ["error", prettierOptions],
    },
  },
);

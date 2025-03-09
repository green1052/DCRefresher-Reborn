import pluginJs from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
    eslintPluginPrettierRecommended,
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    importPlugin.flatConfigs.recommended,
    ...pluginVue.configs["flat/essential"],
    { files: ["**/*.{js,mjs,cjs,ts,vue}"] },
    { languageOptions: { globals: globals.browser } },
    {
        files: ["**/*.vue"],
        languageOptions: { parserOptions: { parser: tseslint.parser } }
    }
];

/*
    {
        rules: {
            "@typescript-eslint/array-type": [
                "error",
                {
                    default: "array-simple"
                }
            ],
            "@typescript-eslint/consistent-generic-constructors": [
                "error",
                "constructor"
            ],
            "@typescript-eslint/consistent-indexed-object-style": [
                "error",
                "record"
            ],
            "import/no-named-as-default": "off",
            "import/order": [
                "error",
                {
                    groups: [
                        "index",
                        "sibling",
                        "parent",
                        "internal",
                        "external",
                        "builtin",
                        "object",
                        "type"
                    ],
                    "newlines-between": "never",
                    alphabetize: {
                        order: "asc",
                        caseInsensitive: true
                    }
                }
            ],
            "prefer-arrow-callback": [
                "error",
                {
                    allowNamedFunctions: true
                }
            ],
            "space-before-function-paren": [
                "error",
                {
                    anonymous: "always",
                    named: "never",
                    asyncArrow: "always"
                }
            ]
        }
    }
 */

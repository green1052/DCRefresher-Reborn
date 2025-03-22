import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
    eslintPluginPrettierRecommended,
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        extends: [
            importPlugin.flatConfigs.recommended,
            importPlugin.flatConfigs.typescript
        ]
    },
    ...pluginVue.configs["flat/vue2-recommended"],
    {
        files: ["*.vue", "**/*.vue"],
        languageOptions: {
            globals: globals.browser,
            parserOptions: {
                parser: tseslint.parser
            }
        }
    }
);

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

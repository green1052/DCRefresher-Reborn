import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    eslintPluginPrettierRecommended,
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        plugins: {
            "simple-import-sort": simpleImportSort
        },
        rules: {
            "simple-import-sort/imports": "error",
            "simple-import-sort/exports": "error",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/ban-ts-comment": "off"
        }
    },
    ...pluginVue.configs["flat/vue2-recommended"],
    {
        files: ["*.vue", "**/*.vue"],
        languageOptions: {
            globals: globals.browser,
            parserOptions: {
                parser: tseslint.parser
            }
        },
        rules: {
            "vue/html-indent": ["error", 4]
        }
    }
);

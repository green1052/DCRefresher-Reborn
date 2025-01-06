const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const {VueLoaderPlugin} = require("vue-loader");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    entry: {
        "refresher.bundle.js": "./src/index.ts",
        "background.js": "./src/root/background.ts",
        "option.bundle.js": "./src/root/option.bundle.ts",
        "./assets/js/alert_register.js": "./src/assets/js/alert_register.ts",
        "./assets/js/alert_unregister.js": "./src/assets/js/alert_unregister.ts",
        "./assets/js/editor.js": "./src/assets/js/editor.ts",
        "./assets/js/grecaptcha.js": "./src/assets/js/grecaptcha.ts",
    },
    output: {
        path: path.join(__dirname, "dist"),
        filename: "[name]",
        clean: true
    },
    module: {
        rules: [
            {
                include: /src/,
                test: /\.js|\.ts$/,
                use: {
                    loader: "swc-loader"
                }
            },
            {
                include: /src/,
                test: /\.s[ac]ss$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    "css-loader",
                    "sass-loader"
                ]
            },
            {
                include: /src/,
                test: /\.vue$/,
                use: {
                    loader: "vue-loader"
                }
            }
        ]
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: "refresher.bundle.css"
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: "src/assets",
                    to: "assets/",
                    filter: async (resourcePath) => {
                        return !resourcePath.endsWith(".ts");
                    }
                }
            ]
        }),
        new HtmlWebpackPlugin({
            template: "./src/views/index.html",
            filename: "views/index.html",
            inject: false
        }),
        new VueLoaderPlugin()
    ],
    resolve: {
        extensions: [".js", ".ts", ".css", ".vue"],
        modules: ["node_modules"]
    }
};
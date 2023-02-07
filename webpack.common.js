const path = require("path");

const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const {VueLoaderPlugin} = require("vue-loader");
const {CleanWebpackPlugin} = require("clean-webpack-plugin");
const {ProvidePlugin} = require("webpack");

module.exports = {
    entry: {
        "refresher.bundle.js": "./src/index.ts",
        "background.js": "./src/root/background.ts",
        "option.bundle.js": "./src/root/option.bundle.ts"
    },
    output: {
        path: path.join(__dirname, "dist"),
        filename: "[name]"
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
                test: /\.scss$/,
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
                    to: "assets/"
                }
            ]
        }),
        new VueLoaderPlugin(),
        new CleanWebpackPlugin(),
        new ProvidePlugin({
            process: "process/browser",
            Buffer: ["buffer", "Buffer"]
        })
    ],
    resolve: {
        extensions: [".js", ".ts", ".css", ".vue"],
        modules: ["node_modules"],
        fallback: {
            buffer: require.resolve("buffer"),
            net: false,
            fs: false,
            async_hooks: false
        }
    }
};
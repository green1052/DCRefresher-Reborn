const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const {VueLoaderPlugin} = require("vue-loader");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    entry: {
        "refresher.bundle.js": "./src/index.ts",
        "background.js": "./src/root/background.ts",
        "option.bundle.js": "./src/root/option.bundle.tsx"
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
                test: /\.(js|ts)x?$/,
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
                    to: "assets/"
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
        extensions: [".js", ".ts", ".jsx", ".tsx", ".css", ".vue"],
        modules: ["node_modules"]
    }
};

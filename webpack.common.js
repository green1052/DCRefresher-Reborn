const path = require("path");

const TerserPlugin = require("terser-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const {VueLoaderPlugin} = require("vue-loader");
const {CleanWebpackPlugin} = require("clean-webpack-plugin");

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
        new CleanWebpackPlugin()
    ],
    resolve: {
        extensions: [".js", ".ts", ".css", ".vue"],
        modules: ["node_modules"]
    },
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                minify: TerserPlugin.swcMinify,
                terserOptions: {
                    format: {
                        comments: false
                    }
                }
            })
        ]
    }
};
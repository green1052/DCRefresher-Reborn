const path = require("path");

const TerserPlugin = require("terser-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const {CleanWebpackPlugin} = require("clean-webpack-plugin");
const CleanTerminalPlugin = require("clean-terminal-webpack-plugin");

const pkg = require("./package.json");

module.exports = {

    entry: {
        "refresher.bundle.js": "./src/index.ts",
        "background.js": "./src/root/background.ts",
        "dccon.bundle.js": "./src/root/dccon.bundle.js",
        "option.bundle.js": "./src/root/option.bundle.js"
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
                use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"]
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
                    from: "src/manifest.json",
                    transform: (content, _p) => {
                        return Buffer.from(
                            JSON.stringify({
                                description: pkg.description,
                                version: pkg.version,
                                ...JSON.parse(content.toString())
                            })
                        );
                    }
                },
                {
                    from: "src/assets",
                    to: "assets/"
                }
            ]
        }),
        new CleanWebpackPlugin({
            cleanAfterEveryBuildPatterns: ["dist"]
        }),
        new CleanTerminalPlugin({
            beforeCompile: true
        })
    ],
    resolve: {
        extensions: [".js", ".ts", ".css"],
        modules: ["node_modules"]
    },
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    format: {
                        comments: false
                    }
                },
                extractComments: false
            })
        ]
    }
};
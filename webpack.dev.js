const common = require("./webpack.common.js");
const {merge} = require("webpack-merge");
const {version} = require("./package.json");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = merge(common, {
    mode: "development",
    devtool: "eval-source-map",
    module: {
        rules: [
            {
                include: /src/,
                test: /\.pug$/,
                loader: "pug-loader",
                options: {
                    globals: {
                        RefresherVersion: version,
                        RefresherDevMode: true
                    }
                }
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: "./src/views/index.pug",
            filename: "views/index.html",
            inject: false,
            templateParameters: {
                RefresherVersion: version,
                RefresherDevMode: true
            }
        }),
        new HtmlWebpackPlugin({
            template: "./src/views/dcconSelection.pug",
            filename: "views/dcconSelection.html",
            inject: false,
            templateParameters: {
                RefresherVersion: version,
                RefresherDevMode: true
            }
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.dirname(require.resolve("vue")),
                    to: "./",
                    filter: path =>
                        path.endsWith("/vue.js")
                },
                {
                    from: path.dirname(require.resolve("webextension-polyfill")),
                    to: "./",
                    filter: path =>
                        path.endsWith("/browser-polyfill.js")
                }
            ]
        })
    ],
    resolve: {
        alias: {
            vue: "vue/dist/vue.js",
            "browser-polyfill": "webextension-polyfill/dist/browser-polyfill.js"
        }
    }
});
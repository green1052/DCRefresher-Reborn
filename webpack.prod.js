const common = require("./webpack.common.js");
const {merge} = require("webpack-merge");
const {version} = require("./package.json");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = merge(common, {
    mode: "production",
    module: {
        rules: [
            {
                include: /src/,
                test: /\.pug$/,
                loader: "pug-loader",
                options: {
                    globals: {
                        RefresherVersion: version,
                        RefresherDevMode: false
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
                RefresherDevMode: false
            }
        }),
        new HtmlWebpackPlugin({
            template: "./src/views/dcconSelection.pug",
            filename: "views/dcconSelection.html",
            inject: false,
            templateParameters: {
                RefresherVersion: version,
                RefresherDevMode: false
            }
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.dirname(require.resolve("vue")),
                    to: "./",
                    filter: path =>
                        path.endsWith("/vue.min.js")
                },
                {
                    from: path.dirname(require.resolve("webextension-polyfill")),
                    to: "./",
                    filter: path =>
                        path.endsWith("/browser-polyfill.min.js")
                }
            ]
        })
    ],
    resolve: {
        alias: {
            vue: "vue/dist/vue.min.js",
            "browser-polyfill": "webextension-polyfill/dist/browser-polyfill.min.js"
        }
    }
});
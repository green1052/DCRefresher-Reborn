const common = require("./webpack.common.js");
const {merge} = require("webpack-merge");
const {version} = require("./package.json");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const pkg = require("./package.json");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = (env) => {
    return merge(common, {
        mode: "development",
        devtool: "cheap-module-source-map",
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
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: `src/${env.manifest}`,
                        to: "manifest.json",
                        transform: (content) => {
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
            new HtmlWebpackPlugin({
                template: "./src/views/index.pug",
                filename: "views/index.html",
                inject: false,
                templateParameters: {
                    RefresherVersion: version,
                    RefresherDevMode: true
                }
            })
        ]
    });
};
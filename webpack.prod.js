const common = require("./webpack.common.js");
const {merge} = require("webpack-merge");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const pkg = require("./package.json");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = (env) => {
    return merge(common, {
        mode: "production",
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
                template: "./src/views/index.html",
                filename: "views/index.html",
                inject: false
            })
        ],
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
    });
};
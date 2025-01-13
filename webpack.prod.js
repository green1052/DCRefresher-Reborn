const pkg = require("./package.json");
const common = require("./webpack.common.js");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const {merge} = require("webpack-merge");

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
                                    ...JSON.parse(String(content))
                                })
                            );
                        }
                    }
                ]
            })
        ],
        optimization: {
            minimize: true,
            minimizer: [
                new TerserPlugin({
                    minify: TerserPlugin.swcMinify
                })
            ]
        }
    });
};
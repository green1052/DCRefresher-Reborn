const pkg = require("./package.json");
const common = require("./webpack.common.js");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const {merge} = require("webpack-merge");

module.exports = (env) => {
    return merge(common, {
        mode: "development",
        devtool: "inline-source-map",
        plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: `src/${env.manifest}`,
                        to: "manifest.json",
                        transform: (content) => JSON.stringify({
                            description: pkg.description,
                            version: pkg.version,
                            version_name: `${pkg.version}-dev`,
                            ...JSON.parse(String(content))
                        })
                    }
                ]
            })
        ]
    });
};
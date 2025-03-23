import CopyWebpackPlugin from "copy-webpack-plugin";
import { merge } from "webpack-merge";

import pkg from "./package.json" with { type: "json" };
import common from "./webpack.common.js";

export default (env) =>
    merge(common, {
        mode: "development",
        devtool: "inline-source-map",
        plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: `src/${env.manifest}`,
                        to: "manifest.json",
                        transform: (content) =>
                            JSON.stringify({
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

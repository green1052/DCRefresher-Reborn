import CopyWebpackPlugin from "copy-webpack-plugin";
import TerserPlugin from "terser-webpack-plugin";
import { merge } from "webpack-merge";

import pkg from "./package.json" with { type: "json" };
import common from "./webpack.common.js";

export default (env) =>
    merge(common, {
        mode: "production",
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
                                ...JSON.parse(String(content))
                            })
                    }
                ]
            })
        ],
        optimization: {
            minimizer: [
                new TerserPlugin({
                    minify: TerserPlugin.swcMinify
                })
            ]
        }
    });

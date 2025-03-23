import CopyWebpackPlugin from "copy-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import path from "path";
import { VueLoaderPlugin } from "vue-loader";

export default {
    entry: {
        "refresher.bundle.js": "./src/index.ts",
        "background.js": "./src/root/background.ts",
        "option.bundle.js": "./src/root/option.bundle.ts",
        "./assets/js/grecaptcha.js": "./src/assets/js/grecaptcha.ts"
    },
    output: {
        path: path.join(path.resolve(), "dist"),
        filename: "[name]",
        clean: true
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
                test: /\.s[ac]ss$/i,
                use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"]
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
                    to: "assets/",
                    filter: async (resourcePath) => {
                        return !resourcePath.endsWith(".ts");
                    }
                }
            ]
        }),
        new HtmlWebpackPlugin({
            template: "./src/views/index.html",
            filename: "views/index.html",
            inject: false
        }),
        new VueLoaderPlugin()
    ],
    resolve: {
        extensions: [".js", ".ts", ".css", ".vue"],
        modules: ["node_modules"]
    }
};

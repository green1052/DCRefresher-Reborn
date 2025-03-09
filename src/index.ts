import "./styles/index.scss";
import { filter } from "./core/filtering";
import { modules } from "./core/modules";
import "./core/block";
import "./core/updateCheck";

const context = require.context("./modules/", true, /\.ts$/);

Promise.all(context.keys().map((v) => modules.load(context(v).default))).then(filter.run);

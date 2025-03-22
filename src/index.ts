import "./styles/index.scss";
import "./core/block";
import "./core/updateCheck";

import { filter } from "./core/filtering";
import { modules } from "./core/modules";

const context = require.context("./modules/", true, /\.ts$/);

Promise.all(context.keys().map((v) => modules.load(context(v).default))).then(filter.run);

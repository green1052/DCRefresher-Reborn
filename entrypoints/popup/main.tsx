import { render } from "preact";

import "@/assets/styles/popup.css";

import {followSystemAppearance} from "@/utils/appearance";

import {App} from "./App";

followSystemAppearance();

render(<App/>, document.getElementById("root")!);

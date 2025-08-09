import "@plasmohq/messaging/background";

import { startHub } from "@plasmohq/messaging/pub-sub";

import "./commands";
import "./contextMenu";
import "./database";
import "./lifecycle";

startHub();

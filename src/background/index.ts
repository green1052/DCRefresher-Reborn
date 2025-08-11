import "@plasmohq/messaging/background";
import "./commands";
import "./contextMenu";
import "./database";
import "./lifecycle";

import { startHub } from "@plasmohq/messaging/pub-sub";

startHub();

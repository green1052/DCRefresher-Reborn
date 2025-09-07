import "@plasmohq/messaging/background";
import {startHub} from "@plasmohq/messaging/pub-sub";
import "./handlers/*.ts";

startHub();
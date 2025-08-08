import { sendToBackground } from "@plasmohq/messaging";
import browser from "webextension-polyfill";

browser.commands.onCommand.addListener(async (command) => {
    sendToBackground({
        name: "broadcast",
        body: {
            type: "executeShortcut",
            data: command,
            targetUrl: "dcinside.com"
        }
    });
});

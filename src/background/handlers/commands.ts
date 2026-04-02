import {sendToBackground} from "@plasmohq/messaging";
import browser from "webextension-polyfill";

browser.commands?.onCommand.addListener((command) => {
    sendToBackground({
        name: "broadcast",
        body: {
            type: "executeShortcut",
            data: command
        }
    });
});

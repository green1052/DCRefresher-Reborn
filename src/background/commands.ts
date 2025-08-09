import { sendToBackground } from "@plasmohq/messaging";

chrome.commands.onCommand.addListener(async (command) => {
    sendToBackground({
        name: "broadcast",
        body: {
            type: "executeShortcut",
            data: command
        }
    });
});

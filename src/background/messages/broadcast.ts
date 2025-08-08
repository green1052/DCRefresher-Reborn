import type { PlasmoMessaging } from "@plasmohq/messaging";
import browser from "webextension-polyfill";

interface BroadcastRequest {
    type: string;
    data?: any;
    targetUrl?: string; // Optional: only send to tabs matching this URL pattern
}

const handler: PlasmoMessaging.MessageHandler<BroadcastRequest> = async (req, res) => {
    const { type, data, targetUrl } = req.body;

    try {
        const tabs = await browser.tabs.query({});
        const promises: Promise<any>[] = [];

        for (const tab of tabs) {
            if (tab.id && tab.url) {
                // Check if we should send to this tab
                if (targetUrl && !tab.url.includes(targetUrl)) {
                    continue;
                }

                promises.push(
                    browser.tabs.sendMessage(tab.id, {
                        type,
                        data
                    }).catch(() => {
                        // Ignore errors for tabs without content script
                    })
                );
            }
        }

        await Promise.all(promises);
        res.send({ success: true, sentTo: promises.length });
    } catch (error) {
        res.send({ success: false, error: error.message });
    }
};

export default handler;
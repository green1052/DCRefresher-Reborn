import type {PlasmoMessaging} from "@plasmohq/messaging";
import browser from "webextension-polyfill";

interface BroadcastRequest {
    type: string;
    data?: any;
}

const handler: PlasmoMessaging.MessageHandler<BroadcastRequest> = async (req, res) => {
    const {type, data} = req.body;

    try {
        const tabs = await browser.tabs.query({});

        const promises: Promise<any>[] = [];

        for (const tab of tabs) {
            if (!tab.id) continue;

            promises.push(
                browser.tabs
                    .sendMessage(tab.id, {
                        type,
                        data
                    })
                    .catch(() => {
                    })
            );
        }

        await Promise.all(promises);
        res.send({success: true, sentTo: promises.length});
    } catch (e) {
        console.error("Broadcast error:", e);
        res.send({success: false, error: e});
    }
};

export default handler;
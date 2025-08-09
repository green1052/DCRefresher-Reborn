import type { PlasmoMessaging } from "@plasmohq/messaging";

interface BroadcastRequest {
    type: string;
    data?: any;
}

const handler: PlasmoMessaging.MessageHandler<BroadcastRequest> = async (req, res) => {
    const { type, data } = req.body;

    try {
        const tabs = await chrome.tabs.query({});
        const promises: Promise<any>[] = [];

        for (const tab of tabs) {
            if (!tab.id || !tab.url) continue;

            promises.push(
                chrome.tabs
                    .sendMessage(tab.id, {
                        type,
                        data
                    })
                    .catch(() => {})
            );
        }

        await Promise.all(promises);
        res.send({ success: true, sentTo: promises.length });
    } catch (error) {
        res.send({ success: false, error: error.message });
    }
};

export default handler;

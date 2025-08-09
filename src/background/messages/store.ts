import type { PlasmoMessaging } from "@plasmohq/messaging";

import { BlockCache, BlockModeCache } from "../../core/block";
import { MemoCache } from "../../core/memo";
import { ModuleStore } from "../../core/modules";
import { SettingsStore } from "../../core/settings";
import storage from "../../utils/storage";

let modules: ModuleStore = {};
let settings: SettingsStore = {};
let blocks: BlockCache = {
    NICK: [],
    ID: [],
    IP: [],
    TITLE: [],
    TEXT: [],
    COMMENT: [],
    DCCON: [],
    TAB: [],
    IMAGE: []
};
let blockModes: BlockModeCache = {
    NICK: "SAME",
    ID: "SAME",
    IP: "SAME",
    TITLE: "CONTAIN",
    TEXT: "CONTAIN",
    COMMENT: "CONTAIN",
    DCCON: "SAME",
    TAB: "SAME",
    IMAGE: "SAME"
};
let memos: MemoCache = {
    UID: {},
    NICK: {},
    IP: {}
};

interface StoreRequest {
    action: "update" | "get";
    type: "modules" | "settings" | "blocks" | "memos" | "userSetting";
    data?: any;
}

const handler: PlasmoMessaging.MessageHandler<StoreRequest> = async (req, res) => {
    const { action, type, data } = req.body;

    if (action === "update") {
        switch (type) {
            case "modules":
                if (data.module_store) modules = data.module_store;
                if (data.settings_store) settings = data.settings_store;
                break;

            case "blocks":
                if (data.updateBlocks && data.blocks_store && data.blockModes_store) {
                    const blockPromises = Object.entries(data.blocks_store).map(([key, value]) =>
                        storage.set(`__REFRESHER_BLOCK:${key}`, value)
                    );
                    const blockModePromises = Object.entries(data.blockModes_store).map(([key, value]) =>
                        storage.set(`__REFRESHER_BLOCK:${key}:$MODE`, value)
                    );
                    await Promise.all([...blockPromises, ...blockModePromises]);
                    blocks = data.blocks_store;
                    blockModes = data.blockModes_store;
                }
                break;

            case "memos":
                if (data.updateMemos && data.memos_store) {
                    const memoPromises = Object.entries(data.memos_store).map(([key, value]) =>
                        storage.set(`__REFRESHER_MEMO:${key}`, value)
                    );
                    await Promise.all(memoPromises);
                    memos = data.memos_store;
                }
                break;

            case "userSetting":
                if (data.name && data.key !== undefined) {
                    await storage.set(`${data.name}.${data.key}`, data.value);
                    
                    if (settings[data.name] && settings[data.name][data.key] !== undefined) {
                        settings[data.name][data.key].value = data.value;
                    }
                }
                break;
        }
        res.send({ success: true });
    } else if (action === "get") {
        switch (type) {
            case "modules":
                res.send({ modules, settings });
                break;
            case "settings":
                res.send({ settings });
                break;
            case "blocks":
                res.send({ blocks, blockModes });
                break;
            case "memos":
                res.send({ memos });
                break;
        }
    }
};

export default handler;

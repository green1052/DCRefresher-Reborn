import {defineExtensionMessaging} from "@webext-core/messaging";

type StoreDataType = "modules" | "settings" | "blocks" | "memos" | "userSetting";
type BroadcastMessageType = string;

interface ProtocolMap {
    store(data: {
        action: "update" | "get";
        type: StoreDataType;
        data?: unknown;
    }): unknown;

    broadcast(data: {
        type: BroadcastMessageType;
        data?: unknown;
    }): { success: boolean; sentTo?: number; error?: unknown };
}

export const {sendMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();

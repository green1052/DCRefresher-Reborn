import {defineExtensionMessaging} from "@webext-core/messaging";

interface ProtocolMap {
    store(data: {
        action: "update" | "get";
        type: "modules" | "settings" | "blocks" | "memos" | "userSetting";
        data?: any;
    }): any;

    broadcast(data: {
        type: string;
        data?: any;
    }): { success: boolean; sentTo?: number; error?: any };
}

export const {sendMessage, onMessage} = defineExtensionMessaging<ProtocolMap>();

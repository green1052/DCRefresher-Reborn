import $ from "cash-dom";

import memo from "../core/memo";
import ip from "./ip";
import storage from "./webStorage";
import type {Nullable, ObjectEnum} from "./types";

export type UserType =
    | "UNFIXED"
    | "HALF_FIXED"
    | "FIXED"
    | "HALF_FIXED_SUB_MANAGER"
    | "FIXED_SUB_MANAGER"
    | "HALF_FIXED_MANAGER"
    | "FIXED_MANAGER";

const USERTYPE: ObjectEnum<UserType> = {
    UNFIXED: "UNFIXED",
    HALF_FIXED: "HALF_FIXED",
    FIXED: "FIXED",
    HALF_FIXED_SUB_MANAGER: "HALF_FIXED_SUB_MANAGER",
    FIXED_SUB_MANAGER: "FIXED_SUB_MANAGER",
    HALF_FIXED_MANAGER: "HALF_FIXED_MANAGER",
    FIXED_MANAGER: "FIXED_MANAGER"
};

let ratio: Record<string, { article: number; comment: number; data: number }> = {};
let ban: Record<string, string[]> = {};

const initializeUserData = async (): Promise<void> => {
    try {
        const [enable, checkRatio, checkPermBan] = await Promise.all([
            storage.get<boolean>("관리.enable"),
            storage.get<boolean>("관리.checkRatio"),
            storage.get<boolean>("관리.checkPermBan")
        ]);

        if (!enable) return;

        if (checkRatio) {
            const moduleData = await storage.module.get<any>("관리");
            ratio = moduleData?.["ratio"] ?? {};
        }
        if (checkPermBan) {
            ban = (await storage.get<any>("refresher.database.ban")) ?? {};
        }
    } catch (e) {
        console.error("Failed to initialize user data:", e);
    }
};

initializeUserData();

const FIXED_MANAGER_ICONS = ["fix_managernik.gif"];
const FIXED_SUB_MANAGER_ICONS = ["fix_sub_managernik.gif"];
const HALF_FIXED_SUB_MANAGER_ICONS = ["sub_managernik.gif"];
const HALF_FIXED_MANAGER_ICONS = ["managernik.gif"];
const FIXED_ICONS = [
    "fix_nik.gif",
    "nftcon_fix.png",
    "dc20th_wgallcon4.png",
    "w_app_gonick_16.png",
    "nftmdcon_fix.png",
    "gnftmdcon_fix.gif",
    "bestcon_fix.png"
];
const HALF_FIXED_ICONS = [
    "nik.gif",
    "nftcon.png",
    "dc20th_wgallcon.png",
    "w_app_nogonick_16.png",
    "nftmdcon.png",
    "gnftmdcon.gif",
    "bestcon.png"
];

export const getType = (icon: string | null): UserType => {
    if (!icon) {
        return USERTYPE.UNFIXED;
    }

    if (FIXED_MANAGER_ICONS.some((suffix) => icon.endsWith(suffix))) {
        return USERTYPE.FIXED_MANAGER;
    }

    if (FIXED_SUB_MANAGER_ICONS.some((suffix) => icon.endsWith(suffix))) {
        return USERTYPE.FIXED_SUB_MANAGER;
    }

    if (HALF_FIXED_SUB_MANAGER_ICONS.some((suffix) => icon.endsWith(suffix))) {
        return USERTYPE.HALF_FIXED_SUB_MANAGER;
    }

    if (HALF_FIXED_MANAGER_ICONS.some((suffix) => icon.endsWith(suffix))) {
        return USERTYPE.HALF_FIXED_MANAGER;
    }

    if (FIXED_ICONS.some((suffix) => icon.endsWith(suffix))) {
        return USERTYPE.FIXED;
    }

    if (HALF_FIXED_ICONS.some((suffix) => icon.endsWith(suffix))) {
        return USERTYPE.HALF_FIXED;
    }

    return USERTYPE.UNFIXED;
};

export class User {
    ip_data: Nullable<string>;
    ip_color: Nullable<string>;
    type: UserType;
    memo: Nullable<RefresherMemoValue>;
    ratio: Nullable<string>;
    ban: Nullable<string>;

    private __ip: Nullable<string>;

    constructor(
        public nick: string,
        public id: Nullable<string>,
        ip: Nullable<string>,
        public icon: Nullable<string>
    ) {
        this.__ip = null;
        this.ip_data = null;
        this.ip_color = null;

        this.nick = nick;
        this.id = id;
        this.ip = ip;

        this.icon = icon;
        this.type = getType(this.icon);
        this.memo = null;
        this.ratio = null;
        this.ban = null;

        this.getMemo();
        this.getRatio();
        this.getBan();
    }

    get ip(): string | null {
        return this.__ip;
    }

    set ip(v: string | null) {
        this.__ip = v;

        if (v === null) return;

        const ispData = ip.ISPData(v);
        this.ip_color = ispData.color;
        this.ip_data = ip.format(ispData);
    }

    static fromDom(dom: HTMLElement | null): User {
        const user = new User("", null, null, null);
        const $dom = $(dom);

        if (!dom || !$dom.length) return user;

        user.nick = dom.dataset.nick || "오류";
        user.id = dom.dataset.uid || null;

        const ip = dom.dataset.ip;
        user.ip = ip ? String(ip) : null;

        user.icon = user.id ? $dom.find("a.writer_nikcon img").attr("src") : null;
        user.type = getType(user.icon);

        user.getMemo();
        user.getRatio();
        user.getBan();

        return user;
    }

    getMemo(): void {
        this.memo = (this.id ? memo.get("UID", this.id) : null) ?? (this.ip ? memo.get("IP", this.ip) : null) ?? memo.get("NICK", this.nick);
    }

    getRatio(): void {
        if (!this.id) return;

        const r = ratio?.[this.id];

        if (!r) return;

        this.ratio = `${r.article}/${r.comment}`;
    }

    getBan(): void {
        if (!this.id) return;

        const bannedFrom = Object.entries(ban)
            .filter(([, userIds]) => userIds.includes(this.id!))
            .map(([key]) => key);

        if (bannedFrom.length === 0) return;

        this.ban = bannedFrom.join(", ");
    }

    isLogout(): boolean {
        return this.ip !== null;
    }

    isMember(): boolean {
        return this.id !== null;
    }
}

export default {
    getType,
    User
};
import * as ip from "./ip";
import * as memo from "../core/memo";
import $ from "cash-dom";
import type { Nullable, ObjectEnum } from "./types";
import storage from "./storage";

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

(async () => {
    const [enable, checkRatio, checkPermBan] = await Promise.all([
        storage.get<boolean>("관리.enable"),
        storage.get<boolean>("관리.checkRatio"),
        storage.get<boolean>("관리.checkPermBan")
    ]);

    if (!enable) return;

    if (checkRatio) ratio = (await storage.module.get<any>("관리"))?.["ratio"] ?? {};
    if (checkPermBan) ban = (await storage.get<any>("refresher.database.ban")) ?? {};
})();

export const getType = (icon: string | null): UserType => {
    if (icon === null) {
        return USERTYPE.UNFIXED;
    } else if (icon.endsWith("fix_managernik.gif")) {
        return USERTYPE.FIXED_MANAGER;
    } else if (icon.endsWith("fix_sub_managernik.gif")) {
        return USERTYPE.FIXED_SUB_MANAGER;
    } else if (icon.endsWith("sub_managernik.gif")) {
        return USERTYPE.HALF_FIXED_SUB_MANAGER;
    } else if (icon.endsWith("managernik.gif")) {
        return USERTYPE.HALF_FIXED_MANAGER;
    } else if (
        icon.endsWith("fix_nik.gif") ||
        icon.endsWith("nftcon_fix.png") ||
        icon.endsWith("dc20th_wgallcon4.png") ||
        icon.endsWith("w_app_gonick_16.png") ||
        icon.endsWith("nftmdcon_fix.png") ||
        icon.endsWith("gnftmdcon_fix.gif") ||
        icon.endsWith("bestcon_fix.png")
    ) {
        return USERTYPE.FIXED;
    } else if (
        icon.endsWith("nik.gif") ||
        icon.endsWith("nftcon.png") ||
        icon.endsWith("dc20th_wgallcon.png") ||
        icon.endsWith("w_app_nogonick_16.png") ||
        icon.endsWith("nftmdcon.png") ||
        icon.endsWith("gnftmdcon.gif") ||
        icon.endsWith("bestcon.png")
    ) {
        return USERTYPE.HALF_FIXED;
    } else {
        return USERTYPE.UNFIXED;
    }
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
        this.memo =
            memo.get("UID", this.id) ?? memo.get("IP", this.ip) ?? memo.get("NICK", this.nick);
    }

    getRatio(): void {
        if (!this.id) return;

        const r = ratio?.[this.id];

        if (!r) return;

        this.ratio = `${r.article}/${r.comment}`;
    }

    getBan(): void {
        if (!this.id) return;

        const list = [];

        for (const [key, value] of Object.entries(ban)) {
            if (value.includes(this.id)) list.push(key);
        }

        if (list.length === 0) return;

        this.ban = list.join(", ");
    }

    isLogout(): boolean {
        return this.ip !== null;
    }

    isMember(): boolean {
        return this.id !== null;
    }
}

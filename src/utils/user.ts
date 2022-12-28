import * as ip from "./ip";
import * as memo from "../core/memo";

const USERTYPE = {
    UNFIXED: 0,
    HALFFIXED: 1,
    FIXED: 2,
    SUBMANAGER: 3,
    MANAGER: 4
};

const getType = (icon: string | null) => {
    if (icon === null) {
        return USERTYPE.UNFIXED;
    }

    if (
        icon.includes("/fix_nik.gif") ||
        icon.includes("/dc20th_wgallcon4.") ||
        icon.includes("gonick_")
    ) {
        return USERTYPE.FIXED;
    } else if (
        icon.includes("/nik.gif") ||
        icon.includes("/dc20th_wgallcon.") ||
        icon.includes("/nogonick_")
    ) {
        return USERTYPE.HALFFIXED;
    } else if (
        icon.includes("sub_manager") ||
        icon.includes("submanager") ||
        icon.includes("/dc20th_wgallcon3.")
    ) {
        return USERTYPE.SUBMANAGER;
    } else if (
        icon.includes("manager") ||
        icon.includes("/dc20th_wgallcon2.")
    ) {
        return USERTYPE.MANAGER;
    }

    return USERTYPE.UNFIXED;
};

export class User {
    nick: string;
    id: string | null;
    ip_data: null | string;
    icon: string | null;
    type: number;
    memo: RefresherMemoValue | null;
    private __ip: string | null;

    constructor(
        nick: string,
        id: string | null,
        ip: string | null,
        icon: string | null
    ) {
        this.__ip = null;
        this.ip_data = null;

        this.nick = nick;
        this.id = id;
        this.ip = ip;

        this.icon = icon;
        this.type = getType(this.icon);
        this.memo = null;

        this.getMemo();
    }

    get ip(): string | null {
        return this.__ip;
    }

    set ip(v: string | null) {
        this.ip_data = v === null ? null : ip.format(ip.ISPData(v));
        this.__ip = v;
    }

    getMemo(): void {
        let value: RefresherMemoValue | null;

        if (this.id) {
            value = memo.get("UID", this.id);
        } else if (this.ip) {
            value = memo.get("IP", this.ip);
        } else {
            value = memo.get("NICK", this.nick);
        }

        this.memo = value;
    }

    import(dom: HTMLElement | null): this {
        if (dom === null) {
            return this;
        }

        const nick = dom.dataset.nick || "오류";
        const uid = dom.dataset.uid || null;
        const ip = dom.dataset.ip || null;
        const icon = uid === null
            ? null
            : dom
                .querySelector("a.writer_nikcon img")!
                .getAttribute("src")!;

        this.nick = nick;
        this.id = uid;
        this.ip = ip;
        this.icon = icon;
        this.type = getType(icon);

        this.getMemo();

        return this;
    }

    isLogout(): boolean {
        return this.ip !== null;
    }

    isMember(): boolean {
        return this.id !== null;
    }
}
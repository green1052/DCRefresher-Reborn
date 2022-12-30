import * as ip from "./ip";
import * as memo from "../core/memo";

export type UserType =
    "UNFIXED"
    | "HALF_FIXED"
    | "FIXED"
    | "HALF_FIXED_SUB_MANAGER"
    | "FIXED_SUB_MANAGER"
    | "HALF_FIXED_MANAGER"
    | "FIXED_MANAGER";

const USERTYPE: { [key in UserType]: UserType } = {
    UNFIXED: "UNFIXED",
    HALF_FIXED: "HALF_FIXED",
    FIXED: "FIXED",
    HALF_FIXED_SUB_MANAGER: "HALF_FIXED_SUB_MANAGER",
    FIXED_SUB_MANAGER: "FIXED_SUB_MANAGER",
    HALF_FIXED_MANAGER: "HALF_FIXED_MANAGER",
    FIXED_MANAGER: "FIXED_MANAGER"
};

export const getType = (icon: string | null): UserType => {
    /*
        주딱 고닉: https://nstatic.dcinside.com/dc/w/images/fix_managernik.gif
        주딱 반고닉: https://nstatic.dcinside.com/dc/w/images/managernik.gif

        파딱 고닉: https://nstatic.dcinside.com/dc/w/images/fix_sub_managernik.gif
        파딱 반고닉: https://nstatic.dcinside.com/dc/w/images/sub_managernik.gif

        고닉: https://nstatic.dcinside.com/dc/w/images/fix_nik.gif
        반고닉: https://nstatic.dcinside.com/dc/w/images/nik.gif

        개 고닉: https://nstatic.dcinside.com/dc/event/nft_gaejugi/nftcon_fix.png
        개 반고닉: https://nstatic.dcinside.com/dc/event/nft_gaejugi/nftcon.png

        개 파딱: https://nstatic.dcinside.com/dc/event/nft_gaejugi/nftcon_submanager.png
        개 반고닉 파딱: https://nstatic.dcinside.com/dc/event/nft_gaejugi/nftcon_fix_submanager.png

        20주년 고닉: https://nstatic.dcinside.com/dc/event/dc20th/dc20th_wgallcon4.png
        20주년 반고닉: https://nstatic.dcinside.com/dc/event/dc20th/dc20th_wgallcon.png

        공앱 고닉: https://nstatic.dcinside.com/dc/event/app_evt/w_app_gonick_16.png
        공앱 반고닉: https://nstatic.dcinside.com/dc/event/app_evt/w_app_nogonick_16.png
     */

    if (icon === null) {
        return USERTYPE.UNFIXED;
    }

    if (icon.endsWith("fix_managernik.gif")) {
        return USERTYPE.FIXED_MANAGER;
    } else if (/(?<!sub_)managernik\.gif$/g.test(icon)) {
        return USERTYPE.HALF_FIXED_MANAGER;
    } else if (icon.endsWith("fix_sub_managernik.gif")) {
        return USERTYPE.FIXED_SUB_MANAGER;
    } else if (icon.endsWith("sub_managernik.gif")) {
        return USERTYPE.HALF_FIXED_SUB_MANAGER;
    } else if (
        icon.endsWith("fix_nik.gif") ||
        icon.endsWith("nftcon_fix.png") ||
        icon.endsWith("dc20th_wgallcon4.png") ||
        icon.endsWith("w_app_gonick_16.png")
    ) {
        return USERTYPE.FIXED;
    } else if (
        icon.endsWith("nik.gif") ||
        icon.endsWith("nftcon.png") ||
        icon.endsWith("dc20th_wgallcon.png") ||
        icon.endsWith("w_app_nogonick_16.png")
    ) {
        return USERTYPE.HALF_FIXED;
    } else {
        return USERTYPE.UNFIXED;
    }
};

export class User {
    nick: string;
    id: string | null;
    ip_data: null | string;
    icon: string | null;
    type: UserType;
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
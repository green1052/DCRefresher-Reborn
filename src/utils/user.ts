import * as ip from "./ip";
import * as memo from "../core/memo";
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
    ip_data: Nullable<string>;
    ip_color: Nullable<string>;
    type: UserType;
    memo: Nullable<RefresherMemoValue>;
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

        this.getMemo();
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

    getMemo(): void {
        this.memo =
            this.id
                ? memo.get("UID", this.id)
                : this.ip
                    ? memo.get("IP", this.ip)
                    : memo.get("NICK", this.nick);
    }

    import(dom: HTMLElement | null): this {
        if (!dom) return this;

        this.nick = dom.dataset.nick || "오류";
        this.id = dom.dataset.uid || null;
        this.ip = dom.dataset.ip || null;

        this.icon =
            !this.id
                ? null
                : dom
                    .querySelector("a.writer_nikcon img")!
                    .getAttribute("src")!;
        this.type = getType(this.icon);

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
import memo from "@/core/memo";
import modules from "@/core/modules";
import ip from "./ip";
import ban from "./ban";
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

const FILE_NAME_MAP = new Map<string, UserType>([
    ["managernik.gif", USERTYPE.HALF_FIXED_MANAGER],
    ["fix_managernik.gif", USERTYPE.FIXED_MANAGER],

    ["fix_sub_managernik.gif", USERTYPE.FIXED_SUB_MANAGER],
    ["sub_managernik.gif", USERTYPE.HALF_FIXED_SUB_MANAGER],

    ["fix_nik.gif", USERTYPE.FIXED],
    ["nftcon_fix.png", USERTYPE.FIXED],
    ["dc20th_wgallcon4.png", USERTYPE.FIXED],
    ["w_app_gonick_16.png", USERTYPE.FIXED],
    ["nftmdcon_fix.png", USERTYPE.FIXED],
    ["gnftmdcon_fix.gif", USERTYPE.FIXED],
    ["bestcon_fix.png", USERTYPE.FIXED],
    ["fix_newnik.gif", USERTYPE.FIXED],

    ["nik.gif", USERTYPE.HALF_FIXED],
    ["nftcon.png", USERTYPE.HALF_FIXED],
    ["dc20th_wgallcon.png", USERTYPE.HALF_FIXED],
    ["w_app_nogonick_16.png", USERTYPE.HALF_FIXED],
    ["nftmdcon.png", USERTYPE.HALF_FIXED],
    ["gnftmdcon.gif", USERTYPE.HALF_FIXED],
    ["bestcon.png", USERTYPE.HALF_FIXED],
    ["newnik.gif", USERTYPE.HALF_FIXED]
]);

export const getType = (icon: string | null): UserType => {
    if (!icon) return USERTYPE.UNFIXED;

    const fileName = icon.split("/").pop();
    if (!fileName) return USERTYPE.UNFIXED;

    return FILE_NAME_MAP.get(fileName) ?? USERTYPE.UNFIXED;
};

export class User {
    ip_data: Nullable<string>;
    ip_color: Nullable<string>;
    type: UserType;
    memo: Nullable<RefresherMemoValue>;
    ratio: Nullable<string>;
    ban: Nullable<string>;

    __ip: Nullable<string>;

    constructor(
        public nick: string,
        public id: Nullable<string>,
        ip: Nullable<string>,
        public icon: Nullable<string>
    ) {
        this.__ip = null;
        this.ip_data = null;
        this.ip_color = null;

        this.ip = ip;

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
        if (!dom) return new User("", null, null, null);

        const id = dom.dataset.uid || null;
        const icon = id
            ? dom.querySelector<HTMLImageElement>("a.writer_nikcon img")?.getAttribute("src") ?? null
            : null;

        return new User(dom.dataset.nick || "오류", id, dom.dataset.ip || null, icon);
    }

    getMemo(): void {
        this.memo = (this.id ? memo.get("UID", this.id) : null) ?? (this.ip ? memo.get("IP", this.ip) : null) ?? memo.get("NICK", this.nick) ?? null;
    }

    getRatio(): void {
        if (!this.id) return;

        const manageModule = modules.get("관리");
        const ratioData = manageModule?.data as {
            ratio?: Record<string, { article: number; comment: number; date: number }>
        } | undefined;
        const r = ratioData?.ratio?.[this.id];

        if (!r) return;

        this.ratio = `${r.article}/${r.comment}`;
    }

    getBan(): void {
        if (!this.id) return;
        this.ban = ban.getBan(this.id);
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

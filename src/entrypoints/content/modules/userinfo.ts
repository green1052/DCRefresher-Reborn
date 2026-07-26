import eventBus from "@/core/eventbus";
import filter from "@/core/filtering";
import memo from "@/core/memo";
import ip from "@/utils/ip";
import {onMessage} from "@/http/messaging";
import {memoAsk} from "@/utils/memoAsk";
import toast from "@/utils/toast";
import type {Nullable, NullableProperties} from "@/utils/types";
import {getType} from "@/utils/user";
import {insertIntoWriterArea} from "@/utils/userDataInsert";

type UserinfoModule = RefresherModule<{
    data: {};
    memory: {
        always: string | null;
        requestBlock: (() => void) | null;
        contextMenu: (() => void) | null;
        selected: NullableProperties<Record<RefresherMemoType, string>>;
        lastSelect: number;
        memoAsk: (() => void) | null;
    };
    settings: {
        showFixedNickUID: RefresherCheckSettings;
        showHalfFixedNickUID: RefresherCheckSettings;
        showIpInfo: RefresherCheckSettings;
    };
}>;

const ipInfoAdd = (ctx: UserinfoModule, element: HTMLElement): void => {
    if (!ctx.status.showIpInfo || !element.dataset.ip || element.dataset.refresherIp === "true") return;

    const ip_data = ip.ISPData(element.dataset.ip);
    const format = ip.format(ip_data);

    if (!format) return;

    const text = document.createElement("span");
    text.className = "refresherUserData";
    text.style.color = ip_data.color;
    text.textContent = `[${format}]`;
    text.title = format;

    const addBox = element.querySelector<HTMLElement>(".addbox .ip");

    if (addBox) {
        addBox.appendChild(text);
    } else {
        text.classList.add("ip");
        element.querySelector<HTMLElement>(".fl .ip")?.appendChild(text);
    }

    element.dataset.refresherIp = "true";
};

const idInfoAdd = (ctx: UserinfoModule, element: HTMLElement): void => {
    if (!element.dataset.uid || element.dataset.refresherId === "true") return;

    const img = element.querySelector<HTMLImageElement>("img")?.src;

    if (!img) return;

    const userType = getType(img);

    if (
        (!ctx.status.showHalfFixedNickUID &&
            (userType === "HALF_FIXED" ||
                userType === "HALF_FIXED_SUB_MANAGER" ||
                userType === "HALF_FIXED_MANAGER")) ||
        (!ctx.status.showFixedNickUID &&
            (userType === "FIXED" || userType === "FIXED_SUB_MANAGER" || userType === "FIXED_MANAGER"))
    )
        return;

    const text = document.createElement("span");
    text.className = "ip refresherUserData";
    text.textContent = `(${element.dataset.uid})`;
    text.title = element.dataset.uid;

    const fl = element.querySelector<HTMLElement>(".fl > span");

    if (fl) {
        const flIpQuery = fl.querySelector<HTMLElement>(".writer_nikcon, .ip");
        if (flIpQuery) fl.insertBefore(text, flIpQuery.nextElementSibling);
    } else {
        const addBox = element.querySelector<HTMLElement>(".addbox");

        if (addBox)
            addBox.appendChild(text);
        else
            element.appendChild(text);
    }

    element.dataset.refresherId = "true";
};

const memoAdd = (ctx: UserinfoModule, element: HTMLElement): void => {
    if (element.dataset.refresherMemoHandler !== "true") {
        element.addEventListener("contextmenu", () => {
            if (!ctx.enable) return;

            const {
                nick = null,
                uid = null,
                ip = null
            } = element.dataset as {
                [K in RefresherMemoType as Lowercase<K>]: K;
            };

            ctx.memory.selected = {
                NICK: nick,
                UID: uid,
                IP: ip
            };

            ctx.memory.lastSelect = Date.now();
        });

        element.dataset.refresherMemoHandler = "true";
    }

    if (element.dataset.refresherMemo === "true") return;

    const memoData: RefresherMemoValue | null | undefined =
        (element.dataset.uid && memo.get("UID", element.dataset.uid)) ||
        (element.dataset.ip && memo.get("IP", element.dataset.ip)) ||
        (element.dataset.nick && memo.get("NICK", element.dataset.nick)) ||
        null;

    if (!memoData) return;

    const text = document.createElement("span");
    text.className = "refresherUserData refresherMemoData";
    text.textContent = `[${memoData.text}]`;
    text.title = memoData.text;

    if (memoData.color) {
        text.style.color = memoData.color;
    }

    insertIntoWriterArea(element, text);

    element.dataset.refresherMemo = "true";
};

const setupWriterInfoFilter = (ctx: UserinfoModule): string =>
    filter.add(
        ".ub-writer:not([user_name])",
        (element) => {
            if (element.dataset.refresherUserInfoHandler !== "true") {
                element.dataset.refresherUserInfoHandler = "true";
            }

            ipInfoAdd(ctx, element);
            idInfoAdd(ctx, element);
            memoAdd(ctx, element);
        },
        {neverExpire: true}
    );

const setupContextMenuHandler = (ctx: UserinfoModule): (() => void) =>
    eventBus.on(
        "refresherUserContextMenu",
        (nick: string | null, uid: string | null, ip: string | null) => {
            ctx.memory.selected = {NICK: nick, UID: uid, IP: ip};
            ctx.memory.lastSelect = Date.now();
        }
    );

const applyMemoResult = async (
    selected: NullableProperties<Record<RefresherMemoType, string>>,
    type: RefresherMemoType,
    value: string
): Promise<void> => {
    // 창을 닫으면 memoAsk가 reject되므로 조용히 무시한다.
    const obj = await memoAsk(selected, memo, type, value).catch(() => null);
    if (!obj) return;

    if (!obj.text) {
        if (memo.get(obj.type, obj.value)) {
            memo.remove(obj.type, obj.value);
            return;
        }

        toast.show(`해당하는 ${memo.TYPE_NAMES[obj.type]}을(를) 가진 사용자 메모가 없습니다.`, "error");
        return;
    }

    memo.add(obj.type, obj.value, obj.text, obj.color);
    toast.show(`${memo.TYPE_NAMES[obj.type]} ${obj.value}에 메모를 추가했습니다.`);
};

const setupMemoAskHandler = (ctx: UserinfoModule): (() => void) =>
    onMessage(
        "refresherRequestMemoAsk",
        async ({data}) => {
            const {type, user} = data;
            const selected: NullableProperties<Record<RefresherMemoType, string>> = {
                IP: null,
                NICK: null,
                UID: null
            };

            (selected[type] as string) = user;

            await applyMemoResult(selected, type, user);
        }
    );

const setupUpdateUserMemoHandler = (ctx: UserinfoModule): (() => void) =>
    eventBus.on("refresherUpdateUserMemo", async () => {
        if (Date.now() - ctx.memory.lastSelect > 10000) {
            return;
        }

        let type: RefresherMemoType = "NICK";
        let value: Nullable<string> = ctx.memory.selected.NICK;

        if (ctx.memory.selected.UID) {
            type = "UID";
            value = ctx.memory.selected.UID;
        } else if (ctx.memory.selected.IP) {
            type = "IP";
            value = ctx.memory.selected.IP;
        }

        if (!value || value.length < 1) {
            return;
        }

        await applyMemoResult(ctx.memory.selected, type, value);
    });

export default {
    name: "유저 정보",
    description: "사용자의 IP, 아이디 정보, 메모를 표시합니다.",
    url: /\/board\/(view|lists)/,
    status: {},
    memory: {
        always: null,
        requestBlock: null,
        contextMenu: null,
        selected: {
            NICK: null,
            UID: null,
            IP: null
        },
        lastSelect: 0,
        memoAsk: null
    },
    enable: true,
    default_enable: true,
    settings: {
        showFixedNickUID: {
            name: "고정닉 UID 표시",
            desc: "고정닉 유저의 UID를 표시합니다.",
            type: "check",
            default: true
        },
        showHalfFixedNickUID: {
            name: "반고정닉 UID 표시",
            desc: "반고정닉 유저의 UID를 표시합니다.",
            type: "check",
            default: true
        },
        showIpInfo: {
            name: "IP 정보 표시",
            desc: "IP 정보를 표시합니다.",
            type: "check",
            default: true
        }
    },
    func() {
        this.memory.always = setupWriterInfoFilter(this);
        this.memory.contextMenu = setupContextMenuHandler(this);
        this.memory.memoAsk = setupMemoAskHandler(this);
        this.memory.requestBlock = setupUpdateUserMemoHandler(this);
    },
    revoke() {
        if (this.memory.always) filter.remove(this.memory.always);
        if (this.memory.contextMenu) this.memory.contextMenu();
        if (this.memory.requestBlock) this.memory.requestBlock();
        if (this.memory.memoAsk) this.memory.memoAsk();

        for (const element of document.querySelectorAll(".refresherUserData")) {
            element.remove();
        }

        // 표시 여부 마커를 지워야 모듈을 다시 켰을 때 정보가 새로 붙는다.
        // refresherMemoHandler는 contextmenu 리스너가 그대로 남아 있으므로 지우면 안 됨.
        for (const element of document.querySelectorAll<HTMLElement>(".ub-writer")) {
            delete element.dataset.refresherIp;
            delete element.dataset.refresherId;
            delete element.dataset.refresherMemo;
        }
    }
} as UserinfoModule;
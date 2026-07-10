import eventBus from "@/core/eventbus";
import filter from "@/core/filtering";
import memo from "@/core/memo";
import ip from "@/utils/ip";
import communicate from "../core/communicate";
import {memoAsk} from "../utils/memoAsk";
import toast from "../utils/toast";
import {createTooltip, tooltipClose, tooltipCreate, tooltipMove} from "../utils/tooltip";
import type {Nullable, NullableProperties} from "../utils/types";
import {getType} from "../utils/user";
import {insertIntoWriterArea} from "../utils/userDataInsert";

const tooltip = createTooltip();

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
        },
        showTooltip: {
            name: "툴팁 표시",
            desc: "마우스를 올리면 정보를 표시합니다.",
            type: "check",
            default: false
        }
    },
    func() {
        const ipInfoAdd = (element: HTMLElement) => {
            if (!this.status.showIpInfo || !element.dataset.ip || element.dataset.refresherIp === "true") return false;

            const ip_data = ip.ISPData(element.dataset.ip);
            const format = ip.format(ip_data);

            if (!format) return false;

            const text = document.createElement("span");
            text.className = "refresherUserData";
            text.style.color = ip_data.color;
            text.textContent = `[${format}]`;
            text.title = format;

            const addBox = element.querySelector(".addbox .ip");

            if (addBox) {
                addBox.appendChild(text);
            } else {
                text.classList.add("ip");
                element.querySelector(".fl .ip")?.appendChild(text);
            }

            element.dataset.refresherIp = "true";
        };

        const IdInfoAdd = (element: HTMLElement) => {
            if (!element.dataset.uid || element.dataset.refresherId === "true") return false;

            const img = element.querySelector("img")?.src;

            if (!img) return false;

            const userType = getType(img);

            if (
                (!this.status.showHalfFixedNickUID &&
                    (userType === "HALF_FIXED" ||
                        userType === "HALF_FIXED_SUB_MANAGER" ||
                        userType === "HALF_FIXED_MANAGER")) ||
                (!this.status.showFixedNickUID &&
                    (userType === "FIXED" || userType === "FIXED_SUB_MANAGER" || userType === "FIXED_MANAGER"))
            )
                return false;

            const text = document.createElement("span");
            text.className = "ip refresherUserData";
            text.textContent = `(${element.dataset.uid})`;
            text.title = element.dataset.uid;

            const fl = element.querySelector(".fl > span");

            if (fl) {
                const flIpQuery = fl.querySelector(".writer_nikcon, .ip");
                if (flIpQuery) fl.insertBefore(text, flIpQuery.nextElementSibling);
            } else {
                const addBox = element.querySelector(".addbox");

                if (addBox)
                    addBox.appendChild(text);
                else
                    element.appendChild(text);
            }

            element.dataset.refresherId = "true";
        };

        const memoAdd = (element: HTMLElement) => {
            if (element.dataset.refresherMemoHandler !== "true") {
                element.addEventListener("contextmenu", () => {
                    if (!this.enable) return;

                    const {
                        nick = null,
                        uid = null,
                        ip = null
                    } = element.dataset as {
                        [K in RefresherMemoType as Lowercase<K>]: K;
                    };

                    this.memory.selected = {
                        NICK: nick,
                        UID: uid,
                        IP: ip
                    };

                    this.memory.lastSelect = Date.now();
                });

                element.dataset.refresherMemoHandler = "true";
            }

            if (element.dataset.refresherMemo === "true") return false;

            const memoData: RefresherMemoValue | null | undefined =
                (element.dataset.uid ? memo.get("UID", element.dataset.uid) : null) ??
                (element.dataset.ip ? memo.get("IP", element.dataset.ip) : null) ??
                (element.dataset.nick ? memo.get("NICK", element.dataset.nick) : null);

            if (!memoData) return false;

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

        this.memory.always = filter.add(
            ".ub-writer:not([user_name])",
            (element) => {
                if (element.dataset.refresherUserInfoHandler !== "true") {
                    element.addEventListener("mouseenter", (ev) => {
                        if (this.enable && this.status.showTooltip) tooltipCreate(tooltip, ev, this.status.showTooltip);
                    });

                    element.addEventListener("mousemove", (ev) => {
                        if (this.enable && this.status.showTooltip) tooltipMove(tooltip, ev, this.status.showTooltip);
                    });

                    element.addEventListener("mouseleave", () => {
                        if (this.enable && this.status.showTooltip) tooltipClose(tooltip, this.status.showTooltip);
                    });

                    element.dataset.refresherUserInfoHandler = "true";
                }

                ipInfoAdd(element);
                IdInfoAdd(element);
                memoAdd(element);
            },
            {
                neverExpire: true
            }
        );

        this.memory.contextMenu = eventBus.on(
            "refresherUserContextMenu",
            (nick: string | null, uid: string | null, ip: string | null) => {
                this.memory.selected = {
                    NICK: nick,
                    UID: uid,
                    IP: ip
                };
                this.memory.lastSelect = Date.now();
            }
        );

        this.memory.memoAsk = communicate.addHook(
            "refresherRequestMemoAsk",
            async (payload) => {
                const {type, user} = payload as { type: RefresherMemoType; user: string };
                const selected: NullableProperties<Record<RefresherMemoType, string>> = {
                    IP: null,
                    NICK: null,
                    UID: null
                };

                (selected[type] as string) = user;

                const obj = await memoAsk(selected, memo, type, user);

                if (!obj.text) {
                    if (memo.get(obj.type, obj.value)) {
                        memo.remove(obj.type, obj.value);
                        return;
                    }

                    toast.show(`해당하는 ${memo.TYPE_NAMES[obj.type]}을(를) 가진 사용자 메모가 없습니다.`, "error");

                    return;
                }

                toast.show(`${memo.TYPE_NAMES[obj.type]} ${obj.value}에 메모를 변경했습니다.`);

                memo.add(obj.type, obj.value, obj.text, obj.color);
            }
        );

        this.memory.requestBlock = eventBus.on("refresherUpdateUserMemo", async () => {
            if (Date.now() - this.memory.lastSelect > 10000) {
                return;
            }

            let type: RefresherMemoType = "NICK";
            let value: Nullable<string> = this.memory.selected.NICK;

            if (this.memory.selected.UID) {
                type = "UID";
                value = this.memory.selected.UID;
            } else if (this.memory.selected.IP) {
                type = "IP";
                value = this.memory.selected.IP;
            }

            if (!value || value.length < 1) {
                return;
            }

            const obj = await memoAsk(this.memory.selected, memo, type, value);

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
        });
    },
    revoke() {
        if (this.memory.always) filter.remove(this.memory.always);
        if (this.memory.contextMenu) eventBus.remove("refresherUserContextMenu", this.memory.contextMenu);
        if (this.memory.requestBlock) eventBus.remove("refresherUpdateUserMemo", this.memory.requestBlock);
        if (this.memory.memoAsk) communicate.clearHook("refresherRequestMemoAsk", this.memory.memoAsk);

        for (const element of document.querySelectorAll(".refresherUserData")) {
            element.remove();
        }
    }
} as RefresherModule<{
    memory: {
        always: string | null;
        requestBlock: string | null;
        contextMenu: string | null;
        selected: NullableProperties<Record<RefresherMemoType, string>>;
        lastSelect: number;
        memoAsk: string | null;
    };
    settings: {
        showFixedNickUID: RefresherCheckSettings;
        showHalfFixedNickUID: RefresherCheckSettings;
        showIpInfo: RefresherCheckSettings;
        showTooltip: RefresherCheckSettings;
    };
}>;

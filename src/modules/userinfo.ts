import * as Toast from "../components/toast";
import * as communicate from "../core/communicate";
import * as color from "../utils/color";
import {getType} from "../utils/user";
import type {Nullable, NullableProperties, ObjectEnum} from "../utils/types";
import $ from "cash-dom";

const tooltip = {
    element: document.createElement("div"),
    init: false,
    lastRequest: 0,
    controller: new AbortController(),
    lastElement: null,
    lastTimeout: 0,
    shouldOutHandle: false,
    cursorOut: false,
    create(ev: MouseEvent, use: boolean) {
        if (!use) return;

        tooltip.cursorOut = false;

        if (Date.now() - tooltip.lastRequest < 150) {
            tooltip.lastRequest = Date.now();
            tooltip.lastElement = ev.target;

            if (tooltip.lastTimeout) clearTimeout(tooltip.lastTimeout);

            tooltip.lastTimeout = window.setTimeout(() => {
                if (
                    !tooltip.cursorOut &&
                    tooltip.lastElement === ev.target
                ) {
                    tooltip.create(ev, use);
                }

                tooltip.cursorOut = false;
            }, 150);

            return;
        }

        tooltip.lastRequest = Date.now();

        tooltip.element.classList.remove("hide");
        tooltip.element.classList.add("refresher-tooltip");

        if (!tooltip.init) {
            document.body.appendChild(tooltip.element);
            tooltip.init = true;
        }

        tooltip.element.innerHTML = `<p>${Array.from($(ev.target as HTMLElement).children(".refresherUserData[title]")).map((e) => e?.outerHTML).join(" ")}</p>`;
    },
    move(ev: MouseEvent, use: boolean) {
        if (!use) return;

        const rect = tooltip.element.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const x = Math.min(ev.clientX, innerWidth - width - 10);
        const y = Math.min(ev.clientY, innerHeight - height - 10);

        tooltip.element.style.transform = `translate(${x}px, ${y}px)`;
    },
    close(use: boolean) {
        tooltip.cursorOut = true;

        if (use) {
            tooltip.controller.abort();
            tooltip.controller = new AbortController();
        }

        tooltip.element.classList.add("hide");
    }
};

const memoAsk = (
    selected: NullableProperties<ObjectEnum<RefresherMemoType>>,
    memo: RefresherMemo,
    type: RefresherMemoType,
    value: string
): Promise<{
    text: string;
    color: string;
    type: RefresherMemoType;
    value: string;
}> => {
    const win = document.createElement("div");
    win.className = "refresher-frame-outer center background";

    let currentType = type;
    let currentValue = value;

    const frame = document.createElement("div");
    frame.className = "refresher-frame refresher-memo-frame center";
    frame.innerHTML = `
  <h3 class="head">메모 종류 선택 <span class="refresher-memo-type mute"></span></h3>
  <div class="memo-row memo-user-type">
    <div class="user-type nick" data-type="NICK">
      <p>닉네임</p>
    </div>
    <div class="user-type uid" data-type="UID">
      <p>아이디</p>
    </div>
    <div class="user-type ip" data-type="IP">
      <p>IP</p>
    </div>
  </div>
  <div class="memo-row">
    <p>메모</p>
    <div class="refresher-input-wrap focus">
      <input id="refresher_memo" type="text" maxlength="160" placeholder="메모를 입력해주세요 (160자 제한)"></input>
    </div>
  </div>
  <div class="memo-row">
    <p>색상</p>
    <br>
    <input type="color" id="refresher_memo_color"></input>
  </div>
  <div class="button-wrap">
    <div class="refresher-preview-button primary" data-update="true"><p>추가</p></div>
    <div class="refresher-preview-button sub" data-clear="true"><p>삭제</p></div>
  </div>
  `;

    win.appendChild(frame);
    document.body.appendChild(win);

    const removeWindow = () => {
        if (!win) return;

        win.classList.remove("fadeIn");
        win.classList.add("fadeOut");

        setTimeout(() => {
            document.body.removeChild(win);
        }, 300);
    };

    const removeWindowKey = (ev: KeyboardEvent) => {
        if (win && ev.code === "Escape") {
            removeWindow();

            window.removeEventListener("keydown", removeWindowKey);
        }
    };

    win.addEventListener("click", (ev) => {
        if (ev.target === win) {
            removeWindow();
        }
    });

    window.addEventListener("keydown", removeWindowKey);

    requestAnimationFrame(() => {
        win.classList.add("fadeIn");
    });

    const memoElement =
        frame.querySelector<HTMLTextAreaElement>("#refresher_memo")!;
    const colorElement = frame.querySelector<HTMLInputElement>(
        "#refresher_memo_color"
    )!;

    const randomColor = () => {
        colorElement.value = color.random();
    };

    const updateType = () => {
        frame.querySelector(
            ".refresher-memo-type"
        )!.innerHTML = `${memo.TYPE_NAMES[currentType]}: ${currentValue}`;

        memoElement.value = "";
        colorElement.value = "";
        randomColor();

        const previousObject = memo.get(currentType, currentValue);
        if (previousObject) {
            memoElement.value = previousObject.text;
            colorElement.value = previousObject.color;
        }
    };

    frame.querySelectorAll<HTMLElement>(".user-type").forEach((userType) => {
        userType.classList.remove("active");

        const type = userType.dataset.type as RefresherMemoType;

        if (type === currentType) {
            userType.classList.add("active");
        }

        if (!selected[type]) {
            userType.classList.add("disable");
        }

        userType.addEventListener("click", () => {
            if (userType.classList.contains("disable")) {
                return;
            }

            frame.querySelectorAll(".user-type").forEach((ut) => {
                ut.classList.remove("active");
            });

            userType.classList.add("active");

            currentType = type ?? "NICK";
            currentValue = selected[currentType] ?? "";

            updateType();
        });
    });
    updateType();

    memoElement.addEventListener("keyup", (e) => {
        if (e.code === "Enter") {
            frame
                .querySelector<HTMLDivElement>(
                    ".refresher-preview-button[data-update=true]"
                )!
                .click();
        }
    });

    return new Promise((resolve) => {
        frame
            .querySelector(".refresher-preview-button[data-update=true]")
            ?.addEventListener("click", () => {
                if (memoElement.value.length > 160) {
                    alert("160자를 초과할 수 없습니다.");

                    return;
                }

                removeWindow();

                resolve({
                    text: memoElement.value,
                    color: colorElement.value,
                    type: currentType,
                    value: currentValue
                });
            });

        frame
            .querySelector(".refresher-preview-button[data-clear=true]")
            ?.addEventListener("click", () => {
                removeWindow();

                resolve({
                    text: "",
                    color: "",
                    type: currentType,
                    value: currentValue
                });
            });
    });
};

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
    require: ["filter", "eventBus", "ip", "memo"],
    func(
        filter,
        eventBus,
        ip,
        memo
    ) {
        const ipInfoAdd = (element: HTMLElement) => {
            if (
                !this.status.showIpInfo ||
                !element.dataset.ip ||
                element.dataset.refresherIp === "true"
            )
                return false;

            const ip_data = ip.ISPData(element.dataset.ip);
            const format = ip.format(ip_data);

            if (!format) return false;

            const text = document.createElement("span");
            text.className = "refresherUserData";
            text.style.color = ip_data.color;
            text.innerHTML = `[${format}]`;
            text.title = format;

            const fl = element.querySelector(".fl > .ip");

            if (fl) {
                fl.appendChild(text);
            } else {
                text.classList.add("ip");
                element.appendChild(text);
            }

            element.dataset.refresherIp = "true";
        };

        const IdInfoAdd = (element: HTMLElement) => {
            if (!element.dataset.uid || element.dataset.refresherId === "true")
                return false;

            const img = element.querySelector("img")?.src;

            if (!img) return false;

            const userType = getType(img);

            if (
                (!this.status.showHalfFixedNickUID &&
                    (userType === "HALF_FIXED" ||
                        userType === "HALF_FIXED_SUB_MANAGER" ||
                        userType === "HALF_FIXED_MANAGER")) ||
                (!this.status.showFixedNickUID &&
                    (userType === "FIXED" ||
                        userType === "FIXED_SUB_MANAGER" ||
                        userType === "FIXED_MANAGER"))
            )
                return false;

            const text = document.createElement("span");
            text.className = "ip refresherUserData";
            text.innerHTML = `(${element.dataset.uid})`;
            text.title = element.dataset.uid;

            const fl = element.querySelector(".fl");

            if (fl) {
                const flIpQuery = fl.querySelector(".ip, .writer_nikcon");

                if (flIpQuery) fl.insertBefore(text, flIpQuery.nextSibling);
            } else {
                text.classList.add("refresherUserData");

                const refresherUserData = element.querySelector(".refresherUserData");

                if (refresherUserData) {
                    element.insertBefore(text, refresherUserData);
                } else {
                    element.appendChild(text);
                }
            }

            element.dataset.refresherId = "true";
        };

        const memoAdd = (element: HTMLElement) => {
            if (element.dataset.refresherMemoHandler !== "true") {
                element.addEventListener("contextmenu", () => {
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

            const memoData: RefresherMemoValue | null = memo.get("UID", element.dataset.uid) ?? memo.get("IP", element.dataset.ip) ?? memo.get("NICK", element.dataset.nick);

            if (!memoData) return false;

            const text = document.createElement("span");
            text.className = "refresherUserData refresherMemoData";
            text.innerHTML = `[${memoData.text}]`;
            text.title = memoData.text;

            if (memoData.color) {
                text.style.color = memoData.color;
            }

            if (element.dataset.ip) {
                const fl = element.querySelector(".fl > .ip");

                if (fl) {
                    fl.appendChild(text);
                } else {
                    const userData = element.querySelector(".refresherUserData");

                    if (userData)
                        element.insertBefore(text, userData);
                    else
                        element.appendChild(text);
                }
            } else {
                const fl = element.querySelector(".fl");

                if (fl) {
                    const flIpQuery = fl.querySelector(".ip, .writer_nikcon");

                    if (flIpQuery) fl.insertBefore(text, flIpQuery.nextSibling);
                } else {
                    const userData = element.querySelector(".refresherUserData");

                    if (userData)
                        element.insertBefore(text, userData);
                    else
                        element.appendChild(text);
                }
            }

            element.dataset.refresherMemo = "true";
        };

        this.memory.always = filter.add(
            ".ub-writer:not([user_name])",
            (element) => {
                element.addEventListener("mouseenter", (ev) => {
                    if (this.status.showTooltip)
                        tooltip.create(ev, this.status.showTooltip);
                });

                element.addEventListener("mousemove", (ev) => {
                    if (this.status.showTooltip)
                        tooltip.move(ev, this.status.showTooltip);
                });

                element.addEventListener("mouseleave", () => {
                    if (this.status.showTooltip)
                        tooltip.close(this.status.showTooltip);
                });

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
            async ({
                       type,
                       user
                   }: {
                type: RefresherMemoType;
                user: RefresherMemoType;
            }) => {
                const selected: NullableProperties<
                    ObjectEnum<RefresherMemoType>
                > = {
                    IP: null,
                    NICK: null,
                    UID: null
                };

                (selected[type] as RefresherMemoType) = user;

                const obj = await memoAsk(selected, memo, type, user);

                // eventBus.emit("refreshRequest");

                if (!obj.text) {
                    if (memo.get(obj.type, obj.value)) {
                        memo.remove(obj.type, obj.value);
                        return;
                    }

                    Toast.show(
                        `해당하는 ${
                            memo.TYPE_NAMES[obj.type]
                        }을(를) 가진 사용자 메모가 없습니다.`,
                        true,
                        3000
                    );

                    return;
                }

                Toast.show(
                    `${memo.TYPE_NAMES[obj.type]} ${
                        obj.value
                    }에 메모를 변경했습니다.`,
                    false,
                    2000
                );

                memo.add(obj.type, obj.value, obj.text, obj.color);
            }
        );

        this.memory.requestBlock = eventBus.on(
            "refresherUpdateUserMemo",
            async () => {
                if (Date.now() - this.memory.lastSelect > 10000) {
                    return;
                }

                let type: RefresherMemoType = "NICK";
                let value: Nullable<RefresherMemoType> =
                    this.memory.selected.NICK;

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

                const obj = await memoAsk(
                    this.memory.selected,
                    memo,
                    type,
                    value
                );

                // eventBus.emit("refreshRequest");

                if (!obj.text) {
                    if (memo.get(obj.type, obj.value)) {
                        memo.remove(obj.type, obj.value);
                        return;
                    }

                    Toast.show(
                        `해당하는 ${
                            memo.TYPE_NAMES[obj.type]
                        }을(를) 가진 사용자 메모가 없습니다.`,
                        true,
                        3000
                    );

                    return;
                }

                memo.add(obj.type, obj.value, obj.text, obj.color);

                Toast.show(
                    `${memo.TYPE_NAMES[obj.type]} ${
                        obj.value
                    }에 메모를 추가했습니다.`,
                    false,
                    2000
                );
            }
        );
    },
    revoke(filter) {
        if (this.memory.always) filter.remove(this.memory.always);

        for (const element of document.querySelectorAll(".refresherUserData")) {
            element.parentElement?.remove();
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
    require: ["filter", "eventBus", "ip", "memo"];
}>;

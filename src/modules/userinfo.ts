import * as color from "../utils/color";
import * as Toast from "../components/toast";
import * as communicate from "../core/communicate";
import {getType} from "../utils/user"

const memoAsk = (
    selected: {
        IP: string,
        NICK: string,
        UID: string
    },
    memo: RefresherMemo,
    type: RefresherMemoType,
    value: string
) => {
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

    win.addEventListener("click", ev => {
        if (ev.target === win) {
            removeWindow();
        }
    });

    window.addEventListener("keydown", removeWindowKey);

    requestAnimationFrame(() => {
        win.classList.add("fadeIn");
    });

    const memoElement = frame.querySelector("#refresher_memo") as HTMLTextAreaElement;
    const colorElement = frame.querySelector(
        "#refresher_memo_color"
    ) as HTMLInputElement;

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

    frame.querySelectorAll(".user-type").forEach(userType => {
        userType.classList.remove("active");

        if ((userType as HTMLElement).dataset.type === currentType) {
            userType.classList.add("active");
        }

        if (!selected[(userType as HTMLElement).dataset.type]) {
            userType.classList.add("disable");
        }

        userType.addEventListener("click", () => {
            if (userType.classList.contains("disable")) {
                return;
            }

            frame.querySelectorAll(".user-type").forEach(ut => {
                ut.classList.remove("active");
            });

            userType.classList.add("active");

            currentType = (userType as HTMLElement).dataset.type as RefresherMemoType || "NICK";
            currentValue = selected[currentType];

            updateType();
        });
    });
    updateType();

    return new Promise(resolve => {
        frame
            .querySelector(".refresher-preview-button[data-update=\"true\"]")
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
            .querySelector(".refresher-preview-button[data-clear=\"true\"]")
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
    url: /gall\.dcinside\.com\/(mgallery\/|mini\/)?board\/(view|lists)/g,
    memory: {
        always: "",
        requestBlock: "",
        contextMenu: "",
        selected: {
            NICK: "",
            UID: "",
            IP: ""
        },
        lastSelect: 0,
        memoAsk: ""
    },
    status: {
        showFixedNickUID: true,
        showHalfFixedNickUID: false,
        showIpInfo: true
    },
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
            default: false
        },

        showIpInfo: {
            name: "IP 정보 표시",
            desc: "IP 정보를 표시합니다.",
            type: "check",
            default: true
        }
    },
    enable: true,
    default_enable: true,
    require: ["filter", "eventBus", "ip", "memo"],
    func: function (
        filter: RefresherFilter,
        eventBus: RefresherEventBus,
        ip: RefresherIP,
        memo: RefresherMemo
    ): void {
        const ipInfoAdd = (elem: HTMLElement) => {
            if (!this.status.showIpInfo || !elem || !elem.dataset.ip || elem.dataset.refresherIp) return false;
            const ip_data = ip.ISPData(elem.dataset.ip);

            const text = document.createElement("span");
            text.className = "ip refresherUserData";
            const format = ip.format(ip_data);
            text.innerHTML = `<span>${
                format.length > 100 ? format.substring(0, 97) + "..." : format
            }</span>`;
            text.title = format;

            const fl = elem.querySelector(".fl");
            if (fl) {
                const flIpQuery = fl.querySelector(".ip");

                if (flIpQuery) {
                    flIpQuery.appendChild(text);
                }
            } else {
                elem.appendChild(text);
            }

            elem.dataset.refresherIp = ip_data && ip_data.name && format;
        };

        const IdInfoAdd = (elem: HTMLElement) => {
            if (!elem || !elem.dataset.uid || elem.dataset.refresherId) return false;

            const img = elem.querySelector("img")?.src;

            if (img === undefined) return false;

            const userType = getType(img);

            if ((!this.status.showHalfFixedNickUID && (userType === "HALF_FIXED" || userType === "HALF_FIXED_SUB_MANAGER" || userType === "HALF_FIXED_MANAGER")) || (!this.status.showFixedNickUID && (userType === "FIXED" || userType === "FIXED_SUB_MANAGER" || userType === "FIXED_MANAGER"))) return false;

            const text = document.createElement("span");
            text.className = "ip refresherUserData";
            text.innerHTML = `<span>(${elem.dataset.uid})</span>`;
            text.title = elem.dataset.uid;
            const fl = elem.querySelector(".fl");
            if (fl) {
                const flIpQuery = fl.querySelector(".ip, .writer_nikcon");

                if (flIpQuery) {
                    fl.insertBefore(text, flIpQuery.nextSibling);
                }
            } else {
                elem.appendChild(text);
            }
            elem.dataset.refresherId = "true";
        };

        const memoAdd = (elem: HTMLElement) => {
            if (!elem.dataset.refresherMemoHandler) {
                elem.addEventListener("contextmenu", () => {
                    const nick = elem.dataset.nick || "";
                    const uid = elem.dataset.uid || "";
                    const ip = elem.dataset.ip || "";
                    this.memory.selected = {
                        NICK: nick,
                        UID: uid,
                        IP: ip
                    };
                    this.memory.lastSelect = Date.now();
                });

                elem.dataset.refresherMemoHandler = "true";
            }

            if (!elem || elem.dataset.refresherMemo) return false;

            let memoData = null;

            if (elem.dataset.uid) {
                memoData ??= memo.get("UID", elem.dataset.uid);
            }

            if (elem.dataset.nick) {
                memoData ??= memo.get("NICK", elem.dataset.nick);
            }

            if (elem.dataset.ip) {
                memoData ??= memo.get("IP", elem.dataset.ip);
            }

            if (!memoData || !memoData.text) {
                return false;
            }

            const text = document.createElement("span");
            text.className = "ip refresherUserData refresherMemoData";
            text.innerHTML = `<span>(${memoData.text}) </span>`;
            text.title = memoData.text;

            if (memoData.color) {
                text.style.color = memoData.color;
            }

            const fl = elem.querySelector(".fl");

            if (fl) {
                const flIpQuery = fl.querySelector(".ip, .writer_nikcon");

                if (flIpQuery) {
                    fl.insertBefore(text, flIpQuery.nextSibling);
                }
            } else {
                elem.appendChild(text);
            }

            elem.dataset.refresherMemo = "true";
        };

        const elemAdd = (elem: HTMLElement | Document) => {
            const list = elem.querySelectorAll(".ub-writer");
            let iter = list.length;

            while (iter--) {
                memoAdd(list[iter] as HTMLElement);
                ipInfoAdd(list[iter] as HTMLElement);
                IdInfoAdd(list[iter] as HTMLElement);
            }
        };

        this.memory.always = filter.add(
            ".ub-writer",
            (elem: HTMLElement) => {
                memoAdd(elem);
                ipInfoAdd(elem);
                IdInfoAdd(elem);
            },
            {
                neverExpire: true
            }
        );
        filter.runSpecific(this.memory.always);

        this.memory.contextMenu = eventBus.on(
            "refresherUserContextMenu",
            (nick: string, uid: string, ip: string) => {
                this.memory.selected = {
                    NICK: nick,
                    UID: uid,
                    IP: ip
                };
                this.memory.lastSelect = Date.now();
            }
        );

        this.memory.memoAsk = communicate.addHook("refresherRequestMemoAsk", async (
            {type, user}: { type: RefresherMemoType, user: string }
        ) => {
            const selected = {
                IP: "",
                NICK: "",
                UID: ""
            };

            selected[type] = user;

            const obj: {
                text: string,
                color: string,
                type: RefresherMemoType,
                value: string
            } = await memoAsk(selected, memo, type, user);

            eventBus.emit("refreshRequest");

            if (!obj.text) {
                if (memo.get(obj.type, obj.value)) {
                    memo.remove(obj.type, obj.value);
                    return;
                }

                Toast.show(
                    `해당하는 ${memo.TYPE_NAMES[obj.type]}을(를) 가진 사용자 메모가 없습니다.`,
                    true,
                    3000
                );

                return;
            }

            Toast.show(
                `${memo.TYPE_NAMES[obj.type]} ${obj.value}에 메모를 변경했습니다.`,
                false,
                2000
            );

            memo.add(obj.type, obj.value, obj.text, obj.color);
        });

        this.memory.requestBlock = eventBus.on("refresherUpdateUserMemo", async () => {
            if (Date.now() - this.memory.lastSelect > 10000) {
                return;
            }

            let type: RefresherMemoType = "NICK";
            let value = this.memory.selected.NICK;

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

            const obj: {
                text: string,
                color: string,
                type: RefresherMemoType,
                value: string
            } = await memoAsk(this.memory.selected, memo, type, value);

            eventBus.emit("refreshRequest");

            if (!obj.text) {
                if (memo.get(obj.type, obj.value)) {
                    memo.remove(obj.type, obj.value);
                    return;
                }

                Toast.show(
                    `해당하는 ${memo.TYPE_NAMES[obj.type]}을(를) 가진 사용자 메모가 없습니다.`,
                    true,
                    3000
                );

                return;
            }

            memo.add(obj.type, obj.value, obj.text, obj.color);

            Toast.show(
                `${memo.TYPE_NAMES[obj.type]} ${obj.value}에 메모를 추가했습니다.`,
                false,
                2000
            );
        });

        elemAdd(document);
    },
    revoke(filter: RefresherFilter): void {
        if (this.memory.always) {
            filter.remove(this.memory.always, true);
        }

        const lists = document.querySelectorAll(".refresherUserData");

        lists.forEach(elem => {
            elem.parentElement?.removeChild(elem);
        });
    }
};
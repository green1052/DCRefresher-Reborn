import * as color from "../utils/color";
import * as Toast from "../components/toast";
import {runtime} from "webextension-polyfill";
import * as communicate from "../core/communicate";
import {eventBus} from "../core/eventbus";

const types: { [index: string]: string } = {
    UID: "유저 ID",
    NICK: "닉네임",
    IP: "IP"
};

const memoAsk = (
    selected: refresherUserTypes,
    lists: { [index: string]: refresherMemo },
    type: string,
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
      <textarea id="refresher_memo"></textarea>
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
        )!.innerHTML = `${types[currentType]}: ${currentValue}`;

        memoElement.value = "";
        colorElement.value = "";
        randomColor();

        const previousObject = lists[`${currentType}@${currentValue}`];
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

        if (!selected[(userType as HTMLElement).dataset.type!.toLowerCase()]) {
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

            currentType = (userType as HTMLElement).dataset.type || "NICK";
            currentValue = selected[currentType.toLowerCase()];

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
    data: {
        memos: {}
    },
    author: {name: "Sochiru", url: ""},
    url: /gall\.dcinside\.com\/(mgallery\/|mini\/)?board\/(view|lists)/g,
    memory: {
        always: "",
        requestBlock: "",
        contextMenu: "",
        selected: {
            nick: "",
            uid: "",
            ip: ""
        },
        lastSelect: 0,
        hookID: ""
    },
    enable: true,
    default_enable: true,
    require: ["filter", "eventBus", "ip"],
    func: function (
        filter: RefresherFilter,
        eventBus: RefresherEventBus,
        ip: RefresherIP
    ): void {
        this.memory.hookID = communicate.addHook("updateMemos", ({memos_store}) => {
            this.data.memos = memos_store;
        });

        const SendToBackground = () => {
            runtime.sendMessage(
                JSON.stringify({
                    memos_store: this.data.memos
                })
            );
        };

        SendToBackground();

        const ipInfoAdd = (elem: HTMLElement) => {
            if (!elem || !elem.dataset.ip || elem.dataset.refresherIp) return false;
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
                    fl.insertBefore(text, flIpQuery.nextSibling);
                }
            } else {
                elem.appendChild(text);
            }

            elem.dataset.refresherIp = ip_data && ip_data.name && format;
        };

        const IdInfoAdd = (elem: HTMLElement) => {
            if (!elem || !elem.dataset.uid || elem.dataset.refresherId) return false;

            const img = elem.querySelector("img");
            if (!img || !img.src.endsWith("nik.gif")) {
                return false;
            }

            const text = document.createElement("span");
            text.className = "ip refresherUserData";
            text.innerHTML = `<span>(${elem.dataset.uid})</span>`;
            text.title = elem.dataset.uid;

            const fl = elem.querySelector(".fl");
            if (fl) {
                const flIpQuery = fl.querySelector(".ip");

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
                        nick,
                        uid,
                        ip
                    };
                    this.memory.lastSelect = Date.now();
                });

                elem.dataset.refresherMemoHandler = "true";
            }

            if (!elem || elem.dataset.refresherMemo) return false;

            let memo = null;

            if (!this.data.memos) {
                this.data.memos = {};
            }

            if (elem.dataset.uid) {
                memo = this.data.memos[`UID@${elem.dataset.uid}`];
            }

            if (!memo && elem.dataset.nick) {
                memo = this.data.memos[`NICK@${elem.dataset.nick}`];
            }

            if (!memo && elem.dataset.ip) {
                memo = this.data.memos[`IP@${elem.dataset.ip}`];
            }

            if (!memo || !memo.text) {
                return false;
            }

            SendToBackground();

            const text = document.createElement("span");
            text.className = "ip refresherUserData refresherMemoData";
            text.innerHTML = `<span>(${memo.text}) </span>`;
            text.title = memo.text;

            if (memo.color) {
                text.style.color = memo.color;
            }

            const fl = elem.querySelector(".fl");
            if (fl) {
                const flIpQuery = fl.querySelector(".ip");

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
                    nick,
                    uid,
                    ip
                };
                this.memory.lastSelect = Date.now();
            }
        );

        this.memory.requestBlock = eventBus.on("refresherUpdateUserMemo", () => {
            if (Date.now() - this.memory.lastSelect > 10000) {
                return;
            }

            let type = "NICK";
            let value = this.memory.selected.nick;

            if (this.memory.selected.uid) {
                type = "UID";
                value = this.memory.selected.uid;
            } else if (this.memory.selected.ip) {
                type = "IP";
                value = this.memory.selected.ip;
            }

            if (!value || value.length < 1) {
                return;
            }

            memoAsk(this.memory.selected, this.data.memos, type, value)
                .then(obj => {
                    eventBus.emit("refreshRequest");

                    if (!obj.text) {
                        if (!this.data.memos[`${obj.type}@${obj.value}`]) {
                            Toast.show(
                                `해당하는 ${
                                    types[obj.type]
                                }을(를) 가진 사용자 메모가 없습니다.`,
                                true,
                                3000
                            );

                            return;
                        }

                        delete this.data.memos[`${obj.type}@${obj.value}`];

                        return;
                    }

                    this.data.memos[`${obj.type}@${obj.value}`] = {
                        text: obj.text,
                        color: obj.color
                    };

                    Toast.show(
                        `${types[obj.type]} ${obj.value}에 메모를 추가했습니다.`,
                        false,
                        2000
                    );
                })
                .catch(e => {
                    console.log(e);
                });
        });

        elemAdd(document);
    },
    revoke(filter: RefresherFilter): void {
        if (this.memory.always) {
            filter.remove(this.memory.always, true);
        }

        if (this.memory.hookID !== "") {
            communicate.clearHook("updateMemos", this.memory.hookID);
        }

        const lists = document.querySelectorAll(".refresherUserData");

        lists.forEach(elem => {
            elem.parentElement?.removeChild(elem);
        });
    }
};
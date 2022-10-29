import { queryString } from "../utils/http";

import * as Toast from "../components/toast";

export default {
    name: "컨텐츠 차단",
    description: "유저, 컨텐츠 등의 보고 싶지 않은 컨텐츠들을 삭제합니다.",
    author: { name: "Sochiru", url: "" },
    url: /gall\.dcinside\.com\/(mgallery\/|mini\/)?board\/(view|lists)/g,
    memory: {
        uuid: "",
        selected: {
            nick: "",
            uid: "",
            ip: ""
        },
        lastSelect: 0,
        addBlock: "",
        requestBlock: ""
    },
    enable: true,
    default_enable: true,
    require: ["filter", "eventBus", "block", "dom"],
    func (
        filter: RefresherFilter,
        eventBus: RefresherEventBus,
        block: RefresherBlock,
        dom: RefresherDOM
    ): void {
        this.memory.uuid = filter.add(
            ".ub-writer",
            async (elem: HTMLElement) => {
                const gallery = queryString("id");

                if (!gallery) {
                    return;
                }

                const nick = elem.dataset.nick || "";
                const uid = elem.dataset.uid || "";
                const ip = elem.dataset.ip || "";

                const blockNickname = block.check("NICK", nick, gallery);
                const blockId = block.check("ID", uid, gallery);
                const blockIP = block.check("IP", ip, gallery);

                if (!elem.oncontextmenu) {
                    elem.oncontextmenu = () => {
                        this.memory.selected = {
                            nick,
                            uid,
                            ip
                        };
                        this.memory.lastSelect = Date.now();
                    };
                }

                if (
                    elem &&
          elem.parentElement &&
          (blockNickname || blockId || blockIP)
                ) {
                    const post = elem.parentElement;
                    if (post && post.className.indexOf("ub-content") > -1) {
                        post.style.display = "none";
                    } else {
                        const content = dom.findNeighbor(post, ".ub-content", 3);

                        if (content) {
                            content.style.display = "none";
                        }
                    }
                }
            },
            {
                neverExpire: true
            }
        );

        this.memory.addBlock = eventBus.on(
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

        this.memory.requestBlock = eventBus.on("refresherRequestBlock", () => {
            if (Date.now() - this.memory.lastSelect > 10000) {
                return;
            }

            let type = "NICK";
            let value = this.memory.selected.nick;
            const extra = this.memory.selected.nick;

            if (this.memory.selected.uid) {
                type = "ID";
                value = this.memory.selected.uid;
            } else if (this.memory.selected.ip) {
                type = "IP";
                value = this.memory.selected.ip;
            }

            if (!value || value.length < 1) {
                return;
            }

            block.add(type, value, false, undefined, extra);
            Toast.show(
                `${block.TYPE_NAMES[type]} ${value}을(를) 차단했습니다.`,
                false,
                3000
            );
        });
    },

    revoke (filter: RefresherFilter): void {
        if (this.memory.uuid) {
            filter.remove(this.memory.uuid);
        }

        if (this.memory.addBlock) {
            filter.remove(this.memory.addBlock);
        }

        if (this.memory.requestBlock) {
            filter.remove(this.memory.requestBlock);
        }
    }
};
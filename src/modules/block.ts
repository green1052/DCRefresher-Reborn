import {queryString} from "../utils/http";
import * as Toast from "../components/toast";
import Cookies from "js-cookie";

export default {
    name: "컨텐츠 차단",
    description: "유저, 컨텐츠 등의 보고 싶지 않은 컨텐츠들을 삭제합니다.",
    author: {name: "Sochiru", url: ""},
    url: /gall\.dcinside\.com\/(mgallery\/|mini\/)?board\/(view|lists)/g,
    memory: {
        uuid: "",
        uuid2: "",
        selected: {
            nick: "",
            uid: "",
            ip: "",
            code: "",
            packageIdx: ""
        },
        lastSelect: 0,
        addBlock: "",
        addDcconBlock: "",
        requestBlock: ""
    },
    enable: true,
    default_enable: true,
    require: ["filter", "eventBus", "block", "dom", "http"],
    func(
        filter: RefresherFilter,
        eventBus: RefresherEventBus,
        block: RefresherBlock,
        dom: RefresherDOM,
        http: RefresherHTTP
    ): void {
        this.memory.uuid = filter.add(
            ".ub-writer",
            async (elem) => {
                const gallery = queryString("id");

                if (!gallery) return;

                const nick = elem.dataset.nick || "";
                const uid = elem.dataset.uid || "";
                const ip = elem.dataset.ip || "";

                const element = elem.closest(".cmt_info")?.querySelector(".written_dccon");
                const dccon = (element?.getAttribute("src") || element?.getAttribute("data-src"))?.replace(/^.*no=/g, "").replace(/^&.*$/g, "") || "";

                const blockNickname = block.check("NICK", nick, gallery);
                const blockId = block.check("ID", uid, gallery);
                const blockIP = block.check("IP", ip, gallery);
                const blockDccon = block.check("DCCON", dccon, gallery);

                if (!elem.oncontextmenu) {
                    elem.oncontextmenu = () => {
                        this.memory.selected = {
                            nick,
                            uid,
                            ip,
                            code: "",
                            packageIdx: ""
                        };
                        this.memory.lastSelect = Date.now();
                    };
                }

                if (
                    elem &&
                    elem.parentElement &&
                    (blockNickname || blockId || blockIP || blockDccon)
                ) {
                    const post = elem.parentElement;
                    if (post && post.className.includes("ub-content")) {
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

        this.memory.uuid2 = filter.add(".written_dccon", async (element: HTMLElement) => {
            if (element.parentElement!.oncontextmenu) return;

            element.parentElement!.oncontextmenu = () => {
                const code = (element?.getAttribute("src") || element?.getAttribute("data-src"))?.replace(/^.*no=/g, "").replace(/^&.*$/g, "") || "";

                this.memory.selected = {
                    nick: "",
                    uid: "",
                    ip: "",
                    code,
                    packageIdx: ""
                };
                this.memory.lastSelect = Date.now();
            };
        });

        this.memory.addBlock = eventBus.on(
            "refresherUserContextMenu",
            (nick: string, uid: string, ip: string) => {
                this.memory.selected = {
                    nick,
                    uid,
                    ip,
                    code: "",
                    packageIdx: ""
                };
                this.memory.lastSelect = Date.now();
            }
        );

        this.memory.addDcconBlock = eventBus.on(
            "refresherDcconUserContextMenu",
            (code: string) => {
                this.memory.selected = {
                    nick: "",
                    uid: "",
                    ip: "",
                    code,
                    packageIdx: ""
                };

                this.memory.lastSelect = Date.now();
            }
        );

        this.memory.requestBlock = eventBus.on("refresherRequestBlock", () => {
            if (Date.now() - this.memory.lastSelect > 10000) {
                return;
            }

            if (this.memory.selected.code || this.memory.selected.packageIdx) {
                const params = new URLSearchParams();
                params.set("ci_t", Cookies.get("ci_c") ?? "");
                params.set("package_idx", this.memory.selected.packageIdx);
                params.set("code", this.memory.selected.code);

                http.make(http.urls.dccon.detail, {
                    method: "POST",
                    headers: {
                        Origin: "https://gall.dcinside.com",
                        "X-Requested-With": "XMLHttpRequest",
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                    },
                    cache: "no-store",
                    body: `?${params.toString()}`
                }).then((response) => {
                    const json = JSON.parse(response);
                    const title = json.info.title;
                    const packageIdx = json.info.package_idx;

                    block.add("DCCON", this.memory.selected.code, false, undefined, `${title} [${packageIdx}]`);

                    Toast.show(
                        `${block.TYPE_NAMES["DCCON"]}을 차단했습니다.`,
                        false,
                        3000
                    );
                });

                return;
            }

            let type: RefresherBlockType = "NICK";
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

    revoke(filter: RefresherFilter): void {
        if (this.memory.uuid) {
            filter.remove(this.memory.uuid);
        }

        if (this.memory.uuid2) {
            filter.remove(this.memory.uuid2);
        }

        if (this.memory.addBlock) {
            filter.remove(this.memory.addBlock);
        }

        if (this.memory.addDcconBlock) {
            filter.remove(this.memory.addDcconBlock);
        }

        if (this.memory.requestBlock) {
            filter.remove(this.memory.requestBlock);
        }
    }
};
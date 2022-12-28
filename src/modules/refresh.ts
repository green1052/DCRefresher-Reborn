import {eventBus} from "../core/eventbus";
import {filter} from "../core/filtering";
import * as Toast from "../components/toast";
import {queryString} from "../utils/http";

const AVERAGE_COUNTS_SIZE = 7;

let PAUSE_REFRESH = false;

const updateRefreshText = (button?: HTMLElement) => {
    button ??= document.querySelector(
        ".page_head .gall_issuebox button[data-refresher=\"true\"]"
    ) as HTMLElement;

    if (!button) return;

    const onOff = button.querySelector("span");
    (onOff as HTMLSpanElement).innerHTML = PAUSE_REFRESH ? "꺼짐" : "켜짐";
};

const addRefreshText = (issueBox: HTMLElement) => {
    const pageHead =
        issueBox || document.querySelector(".page_head .gall_issuebox");

    if (!pageHead?.querySelector("button[data-refresher=\"true\"]")) {
        const button = document.createElement("button");
        button.setAttribute("type", "button");
        button.dataset.refresher = "true";
        button.innerHTML = "새로고침: ";

        const onOff = document.createElement("span");
        onOff.innerHTML = "켜짐";
        button.onclick = () => {
            PAUSE_REFRESH = !PAUSE_REFRESH;
            updateRefreshText(button);
        };
        button.appendChild(onOff);

        updateRefreshText(button);

        pageHead?.appendChild(button);
    }
};

export default {
    name: "글 목록 새로고침",
    description: "글 목록을 자동으로 새로고침합니다.",
    url: /gall\.dcinside\.com\/(mgallery\/|mini\/)?board\/(view|lists)/g,
    status: {
        refreshRate: undefined,
        useBetterBrowse: undefined,
        fadeIn: undefined,
        autoRate: undefined,
        noRefreshOnSearch: false,
        doNotColorVisited: false
    },
    memory: {
        uuid: "",
        uuid2: "",
        cache: {},
        new_counts: 0,
        average_counts: new Array(AVERAGE_COUNTS_SIZE).fill(1),
        delay: 2500,
        refresh: 0,
        calledByPageTurn: false,
        refreshRequest: "",
        lastRefresh: 0,
        load: (): void => {
        }
    },
    enable: true,
    default_enable: true,
    require: ["http", "eventBus", "filter", "block"],
    settings: {
        refreshRate: {
            name: "새로고침 주기",
            desc: "페이지를 새로 고쳐 현재 페이지에 반영하는 주기입니다.",
            type: "range",
            default: 2500,
            bind: "delay",
            min: 1000,
            step: 100,
            max: 20000,
            unit: "ms",
            advanced: false
        },
        autoRate: {
            name: "자동 새로고침 주기",
            desc: "새로 올라오는 글의 수에 따라 새로고침 주기를 자동으로 제어합니다.",
            type: "check",
            default: true,
            advanced: false
        },
        fadeIn: {
            name: "새 게시글 효과",
            desc: "새로 올라온 게시글에 서서히 등장하는 효과를 줍니다.",
            type: "check",
            default: true,
            advanced: false
        },
        useBetterBrowse: {
            name: "인페이지 페이지 전환",
            desc:
                "게시글 목록을 다른 페이지로 넘길 때 페이지를 새로 고치지 않고 넘길 수 있게 설정합니다.",
            type: "check",
            default: true,
            advanced: false
        },
        noRefreshOnSearch: {
            name: "검색 중 페이지 새로고침 안함",
            desc: "사이트 내부 검색 기능을 사용 중일시 새로고침을 사용하지 않습니다.",
            type: "check",
            default: true,
            advanced: false
        },
        doNotColorVisited: {
            name: "방문 링크 색상 지정 비활성화",
            desc: "Firefox와 같이 방문한 링크 색상 지정이 느린 브라우저에서 깜빡거리는 현상을 완화시킵니다.",
            type: "check",
            default: false,
            advanced: true
        }
    },
    shortcuts: {
        refreshLists(this: RefresherModule): void {
            if (this.memory.lastRefresh + 500 > Date.now()) {
                Toast.show("너무 자주 새로고칠 수 없습니다.", true, 1000);

                return;
            }

            this.memory.load();
        },

        refreshPause(this: RefresherModule): void {
            PAUSE_REFRESH = !PAUSE_REFRESH;

            Toast.show(
                PAUSE_REFRESH
                    ? "이번 페이지에서는 새로고침을 사용하지 않습니다."
                    : "이번 페이지에서 새로고침을 사용합니다.",
                false,
                1000
            );

            updateRefreshText();
        }
    },
    func(
        http: RefresherHTTP,
        eventBus: RefresherEventBus,
        filter: RefresherFilter,
        block: RefresherBlock
    ): void {
        if (document && document.documentElement && this.status.doNotColorVisited) {
            document.documentElement.classList.add("refresherDoNotColorVisited");
        }

        const body = (url: string) => {
            return new Promise<Element | null>((resolve, reject) => {
                http.make(url).then((body) => {
                    try {
                        const bodyParse = new DOMParser().parseFromString(body, "text/html");

                        eventBus.emit("refresherGetPost", bodyParse);

                        resolve(bodyParse.querySelector(".gall_list tbody"));
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        };

        const isPostView = location.href.includes("/board/view");
        const currentPostNo = new URLSearchParams(location.href).get("no");

        let originalLocation = location.href;

        if (this.status.noRefreshOnSearch && queryString("s_keyword")) {
            PAUSE_REFRESH = true;
            updateRefreshText();
        }

        filter.add(".page_head .gall_issuebox", (elem) => {
            addRefreshText(elem);
        });

        this.memory.load = async (
            customURL?: string,
            force?: boolean
        ): Promise<boolean> => {
            if (!force && Date.now() < this.memory.lastRefresh + 500) {
                return false;
            }

            if (document.hidden) {
                return false;
            }

            if (PAUSE_REFRESH && !force) {
                return false;
            }

            const userDataLyr = document.getElementById("user_data_lyr");

            // 유저 메뉴가 열렸을 때는 새로고침 하지 않음
            if (userDataLyr && userDataLyr.style.display !== "none") {
                return false;
            }

            this.memory.lastRefresh = Date.now();

            const isAdmin =
                document.querySelector(".useradmin_btnbox button") !== null;

            // 글 선택 체크박스에 체크된 경우 새로 고침 건너 뜀
            if (
                isAdmin &&
                Array.from(document.querySelectorAll(".article_chkbox")).filter(
                    (v) => (v as HTMLInputElement).checked
                ).length > 0
            ) {
                return false;
            }

            this.memory.new_counts = 0;

            if (customURL) {
                originalLocation = customURL;
            }

            const url = http.view(originalLocation);
            const newList = await body(url);

            let oldList = document.querySelector(".gall_list tbody");
            if (!oldList || !newList || newList.children.length === 0) return false;

            const cached = Array.from(oldList.querySelectorAll("td.gall_num"))
                .map((v) => v.innerHTML)
                .join("|");

            if (oldList.parentElement) {
                oldList.parentElement.appendChild(newList);
                oldList.parentElement.removeChild(oldList);
            }
            oldList = null;

            const posts = newList.querySelectorAll("tr.us-post");
            if (posts) {
                posts.forEach((tr) => {
                    const writter = (tr as HTMLElement).querySelector(
                        ".ub-writer"
                    ) as HTMLElement;

                    if (!writter) {
                        return;
                    }

                    if (
                        block.checkAll({
                            NICK: writter.dataset.nick || "",
                            ID: writter.dataset.uid || "",
                            IP: writter.dataset.ip || ""
                        })
                    ) {
                        tr.parentElement?.removeChild(tr);
                    }
                });
            }

            const postNoIter = newList.querySelectorAll("td.gall_num");

            let containsEmpty = false;
            if (newList.parentElement) {
                containsEmpty = newList.parentElement.classList.contains("empty");

                if (postNoIter.length) {
                    if (containsEmpty) {
                        newList.parentElement.classList.remove("empty");
                    }
                } else if (!containsEmpty) {
                    newList.parentElement.classList.add("empty");
                }
            }

            postNoIter.forEach((v) => {
                const value = v.innerHTML;

                if (!cached.includes(value) && value != currentPostNo) {
                    if (this.status.fadeIn && !this.memory.calledByPageTurn) {
                        if (v.parentElement) {
                            v.parentElement.className += " refresherNewPost";
                            v.parentElement.style.animationDelay =
                                this.memory.new_counts * 23 + "ms";
                        }
                    }
                    this.memory.new_counts++;
                }

                if (isPostView) {
                    if (value === currentPostNo) {
                        v.innerHTML = "<span class=\"sp_img crt_icon\"></span>";
                        v.parentElement?.classList.add("crt");
                    }
                }
            });

            if (this.memory.average_counts && !this.memory.calledByPageTurn) {
                this.memory.average_counts.push(this.memory.new_counts);

                if (this.memory.average_counts.length > AVERAGE_COUNTS_SIZE) {
                    this.memory.average_counts.shift();
                }

                const average =
                    this.memory.average_counts.reduce((a, b) => a + b) /
                    this.memory.average_counts.length;

                if (this.status.autoRate) {
                    this.memory.delay = Math.max(
                        600,
                        8 * Math.pow(2 / 3, 3 * average) * 1000
                    );
                }
            }

            this.memory.calledByPageTurn = false;

            // 미니 갤, 마이너 갤 관리자일 경우 체크박스를 생성합니다.
            if (isAdmin) {
                let noTempl = false;
                document.querySelectorAll(".us-post").forEach((elem) => {
                    const tmpl = document.querySelector("#minor_td-tmpl");

                    if (!tmpl) {
                        noTempl = true;
                        return;
                    }

                    elem.innerHTML = tmpl.innerHTML + elem.innerHTML;
                });

                if (!noTempl) {
                    document.querySelectorAll(".ub-content").forEach((elem) => {
                        if (!elem.className.includes("us-post")) {
                            elem.insertBefore(document.createElement("td"), elem.firstChild);
                        }
                    });

                    if (document.querySelector("#comment_chk_all")) {
                        const tbody_colspan = document.querySelector(
                            "table.gall_list tbody td"
                        );

                        if (tbody_colspan) {
                            const colspan = tbody_colspan.getAttribute("colspan") || "";

                            if (parseInt(colspan) == 6) {
                                tbody_colspan?.setAttribute(
                                    "colspan",
                                    (parseInt(colspan) + 1).toString()
                                );
                            }
                        }
                    }
                }
            }

            // 검색일 경우 강조 표시 생성
            if (queryString("s_keyword")) {
                const keyword = (document.querySelector(
                    "input[name=s_keyword]"
                ) as HTMLInputElement).value;

                if (keyword && keyword != "" && keyword != "null") {
                    document.querySelectorAll(".gall_list .gall_tit").forEach((element) => {
                        const tmp_subject = (element.querySelector(
                            "a:first-child"
                        ) as HTMLAnchorElement).cloneNode(true) as HTMLElement;

                        const iconImg = tmp_subject.querySelector(".icon_img");
                        iconImg?.parentElement?.removeChild(iconImg);

                        const tmp_subject_html = tmp_subject.innerHTML;

                        if (tmp_subject_html.match(keyword)) {
                            let subject = tmp_subject_html.replace(
                                keyword,
                                "<span class=\"mark\">" + keyword + "</span>"
                            );

                            subject = element
                                .querySelector("a:first-child")
                                ?.innerHTML.replace(tmp_subject_html, subject) as string
                            ;(element.querySelector(
                                "a:first-child"
                            ) as HTMLAnchorElement).innerHTML = subject;
                        }
                    });
                }
            }

            eventBus.emit("refresh", newList);

            return true;
        };

        const run = (skipLoad?: boolean) => {
            if (!skipLoad) {
                this.memory.load();
            }

            if (!this.status.autoRate) {
                this.memory.delay = Math.max(1000, this.status.refreshRate || 2500);
            }

            if (this.memory.refresh) {
                clearTimeout(this.memory.refresh);
            }

            this.memory.refresh = setTimeout(run, this.memory.delay);
        };

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                if (this.memory.refresh) {
                    clearTimeout(this.memory.refresh);
                }

                return;
            }

            run();
        });

        run(true);

        this.memory.refreshRequest = eventBus.on("refreshRequest", () => {
            if (this.memory.refresh) {
                clearTimeout(this.memory.refresh);
            }

            this.memory.load(null, true);
        });

        if (this.status.useBetterBrowse) {
            this.memory.uuid = filter.add(
                ".left_content .bottom_paging_box a",
                (a: Element) => {
                    if ((a as HTMLAnchorElement).href.includes("javascript:")) return;

                    (a as HTMLAnchorElement).onclick = () => false;

                    (a as HTMLAnchorElement).addEventListener("click", async () => {
                        const isPageView = location.href.includes("/board/view");

                        if (isPageView) {
                            history.pushState(
                                null,
                                document.title,
                                http.mergeParamURL(location.href, (a as HTMLAnchorElement).href)
                            );
                        } else {
                            history.pushState(
                                null,
                                document.title,
                                (a as HTMLAnchorElement).href
                            );
                        }
                        this.memory.calledByPageTurn = true;

                        await this.memory.load(location.href, true);

                        const query = document.querySelector(
                            isPageView ? ".view_bottom_btnbox" : ".page_head"
                        );

                        if (query) {
                            query.scrollIntoView({block: "start", behavior: "smooth"});
                        }
                    });
                }
            );

            window.addEventListener("popstate", () => {
                this.memory.calledByPageTurn = true;
                this.memory.load(null, true);
            });

            this.memory.uuid2 = eventBus.on(
                "refresherGetPost",
                (parsedBody: Document) => {
                    const pagingBox = parsedBody.querySelector(
                        ".left_content .bottom_paging_box"
                    );

                    const currentBottomPagingBox = document.querySelector(
                        ".left_content .bottom_paging_box"
                    );

                    if (currentBottomPagingBox && pagingBox) {
                        currentBottomPagingBox.innerHTML = pagingBox.innerHTML;
                    }

                    const pagingBoxAnchors = document.querySelectorAll(
                        ".left_content .bottom_paging_box a"
                    );

                    if (pagingBoxAnchors) {
                        pagingBoxAnchors.forEach(async (a) => {
                            const href = (a as HTMLAnchorElement).href;

                            if (href.includes("javascript:")) return;

                            (a as HTMLAnchorElement).onclick = () => false;

                            (a as HTMLAnchorElement).addEventListener("click", async () => {
                                if (location.href.includes("/board/view")) {
                                    history.pushState(
                                        null,
                                        document.title,
                                        http.mergeParamURL(location.href, href)
                                    );
                                } else {
                                    history.pushState(null, document.title, href);
                                }
                                this.memory.calledByPageTurn = true;

                                await this.memory.load(location.href, true);

                                const query = document.querySelector(
                                    location.href.includes("/board/view")
                                        ? ".view_bottom_btnbox"
                                        : ".page_head"
                                );

                                if (query) {
                                    query.scrollIntoView({block: "start", behavior: "smooth"});
                                }
                            });
                        });
                    }
                }
            );
        }
    },

    revoke(): void {
        if (document && document.body) {
            document.body.classList.remove("refresherDoNotColorVisited");
        }

        if (this.memory.refresh) {
            clearTimeout(this.memory.refresh);
        }

        if (this.memory.uuid) {
            filter.remove(this.memory.uuid);
        }

        if (this.memory.uuid2) {
            eventBus.remove("refresherGetPost", this.memory.uuid2);
        }

        if (this.memory.refreshRequest) {
            eventBus.remove("refreshRequest", this.memory.refreshRequest);
        }
    }
};
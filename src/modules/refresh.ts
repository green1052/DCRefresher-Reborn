import * as Toast from "../components/toast";
import { queryString } from "../utils/http";

const AVERAGE_COUNTS_SIZE = 7;

let PAUSE_REFRESH = false;

const updateRefreshText = (button?: HTMLElement) => {
    button ??= document.querySelector<HTMLElement>(
        '.page_head .gall_issuebox button[data-refresher="true"]'
    )!;

    const onOff = button.querySelector<HTMLSpanElement>("span")!;
    onOff.innerHTML = PAUSE_REFRESH ? "꺼짐" : "켜짐";
};

const addRefreshText = (issueBox: HTMLElement) => {
    const pageHead =
        issueBox || document.querySelector(".page_head .gall_issuebox");

    if (!pageHead?.querySelector('button[data-refresher="true"]')) {
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
    status: {},
    memory: {
        uuid: null,
        uuid2: null,
        cache: {},
        new_counts: 0,
        average_counts: new Array(AVERAGE_COUNTS_SIZE).fill(1),
        delay: 2500,
        refresh: 0,
        calledByPageTurn: false,
        refreshRequest: "",
        lastRefresh: 0,
        load: null
    },
    enable: true,
    default_enable: true,
    settings: {
        refreshRate: {
            name: "새로고침 주기",
            desc: "페이지를 새로 고쳐 현재 페이지에 반영하는 주기입니다.",
            type: "range",
            default: 2500,
            min: 1000,
            max: 20000,
            step: 100,
            unit: "ms"
        },
        autoRate: {
            name: "자동 새로고침 주기",
            desc: "새로 올라오는 글의 수에 따라 새로고침 주기를 자동으로 제어합니다.",
            type: "check",
            default: true
        },
        fadeIn: {
            name: "새 게시글 효과",
            desc: "새로 올라온 게시글에 서서히 등장하는 효과를 줍니다.",
            type: "check",
            default: true
        },
        useBetterBrowse: {
            name: "인페이지 페이지 전환",
            desc: "게시글 목록을 다른 페이지로 넘길 때 페이지를 새로 고치지 않고 넘길 수 있게 설정합니다.",
            type: "check",
            default: true
        },
        noRefreshOnSearch: {
            name: "검색 중 페이지 새로고침 안함",
            desc: "사이트 내부 검색 기능을 사용 중일시 새로고침을 사용하지 않습니다.",
            type: "check",
            default: true
        },
        doNotColorVisited: {
            name: "방문 링크 색상 지정 비활성화",
            desc: "Firefox와 같이 방문한 링크 색상 지정이 느린 브라우저에서 깜빡거리는 현상을 완화시킵니다.",
            type: "check",
            default: false
        }
    },
    shortcuts: {
        refreshLists() {
            if (this.memory.lastRefresh + 500 > Date.now()) {
                Toast.show("너무 자주 새로고칠 수 없습니다.", true, 1000);
                return;
            }

            this.memory.load!();
        },
        refreshPause() {
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
    require: ["http", "eventBus", "filter"],
    func(
        http: RefresherHTTP,
        eventBus: RefresherEventBus,
        filter: RefresherFilter
    ) {
        if (this.status.doNotColorVisited) {
            document?.documentElement?.classList.add(
                "refresherDoNotColorVisited"
            );
        }

        const body = (url: string) =>
            http.make(url).then((body) => {
                const bodyParse = new DOMParser().parseFromString(
                    body,
                    "text/html"
                );

                eventBus.emit("refresherGetPost", bodyParse);

                return bodyParse.querySelector(".gall_list tbody");
            });

        const isPostView = location.href.includes("/board/view");
        const currentPostNo = new URLSearchParams(location.href).get("no");

        let originalLocation = location.href;

        if (this.status.noRefreshOnSearch && queryString("s_keyword")) {
            PAUSE_REFRESH = true;
            updateRefreshText();
        }

        filter.add(".page_head .gall_issuebox", (element) => {
            addRefreshText(element);
        });

        const { memory } = this;

        memory.load = async (customURL?, force?): Promise<boolean> => {
            if (document.hidden) {
                return false;
            }
            if (
                !force &&
                (Date.now() < memory.lastRefresh + 500 || PAUSE_REFRESH)
            ) {
                return false;
            }

            const userDataLyr =
                document.querySelector<HTMLElement>("#user_data_lyr");

            // 유저 메뉴가 열렸을 때는 새로고침 하지 않음
            if (userDataLyr?.style.display !== "none") return false;

            memory.lastRefresh = Date.now();

            const isAdmin =
                document.querySelector(".useradmin_btnbox button") !== null;

            // 글 선택 체크박스에 체크된 경우 새로 고침 건너 뜀
            if (
                isAdmin &&
                Array.from(
                    document.querySelectorAll<HTMLInputElement>(
                        ".article_chkbox"
                    )
                ).some((v) => v.checked)
            )
                return false;

            memory.new_counts = 0;

            if (customURL) {
                originalLocation = customURL;
            }

            const url = http.view(originalLocation);
            const newList = await body(url);

            const oldList = document.querySelector(".gall_list tbody");

            if (!oldList || !newList || newList.children.length === 0)
                return false;

            const cached = Array.from(oldList.querySelectorAll("td.gall_num"))
                .map((v) => v.innerHTML)
                .join("|");

            const tbody =
                oldList.parentElement?.querySelector<HTMLElement>("tbody");

            if (!tbody) return false;

            tbody.innerHTML = newList.innerHTML;

            const postNoIter = newList.querySelectorAll("td.gall_num");

            let containsEmpty = false;
            if (newList.parentElement) {
                containsEmpty =
                    newList.parentElement.classList.contains("empty");

                if (postNoIter.length) {
                    if (containsEmpty) {
                        newList.parentElement.classList.remove("empty");
                    }
                } else if (!containsEmpty) {
                    newList.parentElement.classList.add("empty");
                }
            }

            for (const v of postNoIter) {
                const value = v.innerHTML;

                if (!cached.includes(value) && value !== currentPostNo) {
                    if (
                        this.status.fadeIn &&
                        !memory.calledByPageTurn &&
                        v.parentElement
                    ) {
                        v.parentElement.classList.add("refresherNewPost");
                        v.parentElement.style.animationDelay = `${
                            memory.new_counts * 23
                        }ms`;
                    }
                    memory.new_counts++;
                }

                if (isPostView && currentPostNo === value) {
                    v.innerHTML = '<span class="sp_img crt_icon></span>"';
                    v.parentElement?.classList.add("crt");
                }
            }

            if (!memory.calledByPageTurn) {
                const averageCounts = memory.average_counts;
                averageCounts.push(memory.new_counts);

                if (averageCounts.length > AVERAGE_COUNTS_SIZE) {
                    averageCounts.shift();
                }

                const average =
                    averageCounts.reduce((a, b) => a + b) /
                    averageCounts.length;

                if (this.status.autoRate) {
                    memory.delay = Math.max(
                        600,
                        8 * Math.pow(2 / 3, 3 * average) * 1000
                    );
                }
            }

            memory.calledByPageTurn = false;

            // 미니 갤, 마이너 갤 관리자일 경우 체크박스를 생성합니다.
            if (isAdmin) {
                let templExists = true;
                document.querySelectorAll(".us-post").forEach((elem) => {
                    const tmpl = document.querySelector("#minor_td-tmpl");

                    if (!tmpl) {
                        templExists = false;
                        return;
                    }

                    elem.innerHTML = tmpl.innerHTML + elem.innerHTML;
                });

                if (templExists) {
                    document.querySelectorAll(".ub-content").forEach((elem) => {
                        if (!elem.className.includes("us-post")) {
                            elem.insertBefore(
                                document.createElement("td"),
                                elem.firstChild
                            );
                        }
                    });

                    if (document.querySelector("#comment_chk_all")) {
                        const tbody_colspan = document.querySelector(
                            "table.gall_list tbody td"
                        );

                        if (tbody_colspan) {
                            const colspan =
                                tbody_colspan.getAttribute("colspan") ?? "";

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
                const keyword = document.querySelector<HTMLInputElement>(
                    "input[name=s_keyword]"
                )?.value;

                if (keyword && keyword !== "null") {
                    document
                        .querySelectorAll(".gall_list .gall_tit")
                        .forEach((element) => {
                            const tmp_subject = element
                                .querySelector<HTMLAnchorElement>(
                                    "a:first-child"
                                )
                                ?.cloneNode(true) as HTMLElement;

                            const iconImg =
                                tmp_subject?.querySelector(".icon_img");
                            iconImg?.parentElement?.removeChild(iconImg);

                            const tmp_subject_html = tmp_subject.innerHTML;

                            if (tmp_subject_html.match(keyword)) {
                                let subject = tmp_subject_html.replace(
                                    keyword,
                                    `<span class="mark">${keyword}</span>`
                                );

                                subject = element
                                    .querySelector("a:first-child")!
                                    .innerHTML.replace(
                                        tmp_subject_html,
                                        subject
                                    );

                                element.querySelector<HTMLAnchorElement>(
                                    "a:first-child"
                                )!.innerHTML = subject;
                            }
                        });
                }
            }

            eventBus.emit("refresh", newList);

            return true;
        };

        const run = (skipLoad?: boolean) => {
            if (!skipLoad) {
                memory.load!();
            }

            if (!this.status.autoRate) {
                memory.delay = Math.max(1000, this.status.refreshRate);
            }

            if (memory.refresh) {
                clearTimeout(memory.refresh);
            }

            memory.refresh = window.setTimeout(run, memory.delay);
        };

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                if (memory.refresh) {
                    clearTimeout(memory.refresh);
                }

                return;
            }

            run();
        });

        run(true);

        memory.refreshRequest = eventBus.on("refreshRequest", () => {
            if (memory.refresh) {
                clearTimeout(memory.refresh);
            }

            memory.load!(undefined, true);
        });

        if (this.status.useBetterBrowse) {
            memory.uuid = filter.add<HTMLAnchorElement>(
                ".left_content article:has(.gall_listwrap) .bottom_paging_box a",
                (element) => {
                    if (element.href.includes("javascript:")) return;

                    element.onclick = () => false;

                    element.addEventListener("click", async () => {
                        const isPageView =
                            location.href.includes("/board/view");

                        if (isPageView) {
                            history.pushState(
                                null,
                                document.title,
                                http.mergeParamURL(location.href, element.href)
                            );
                        } else {
                            history.pushState(
                                null,
                                document.title,
                                element.href
                            );
                        }

                        memory.calledByPageTurn = true;

                        await memory.load!(location.href, true);

                        document
                            .querySelector(
                                isPageView
                                    ? ".view_bottom_btnbox"
                                    : ".page_head"
                            )
                            ?.scrollIntoView({
                                block: "start",
                                behavior: "smooth"
                            });
                    });
                }
            );

            window.addEventListener("popstate", () => {
                memory.calledByPageTurn = true;
                memory.load!(undefined, true);
            });

            memory.uuid2 = eventBus.on(
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

                    const pagingBoxAnchors =
                        document.querySelectorAll<HTMLAnchorElement>(
                            ".left_content .bottom_paging_box a"
                        );

                    if (pagingBoxAnchors) {
                        pagingBoxAnchors.forEach(async (a) => {
                            const href = a.href;

                            if (href.includes("javascript:")) return;

                            a.onclick = () => false;

                            a.addEventListener("click", async () => {
                                if (location.href.includes("/board/view")) {
                                    history.pushState(
                                        null,
                                        document.title,
                                        http.mergeParamURL(location.href, href)
                                    );
                                } else {
                                    history.pushState(
                                        null,
                                        document.title,
                                        href
                                    );
                                }
                                memory.calledByPageTurn = true;

                                await memory.load!(location.href, true);

                                const query = document.querySelector(
                                    location.href.includes("/board/view")
                                        ? ".view_bottom_btnbox"
                                        : ".page_head"
                                );

                                query?.scrollIntoView({
                                    block: "start",
                                    behavior: "smooth"
                                });
                            });
                        });
                    }
                }
            );
        }
    },
    revoke(
        http: RefresherHTTP,
        eventBus: RefresherEventBus,
        filter: RefresherFilter
    ) {
        document?.body?.classList.remove("refresherDoNotColorVisited");

        const { memory } = this;

        if (memory.refresh) {
            clearTimeout(memory.refresh);
        }

        if (memory.uuid) {
            filter.remove(memory.uuid);
        }

        if (memory.uuid2) {
            eventBus.remove("refresherGetPost", memory.uuid2);
        }

        if (memory.refreshRequest) {
            eventBus.remove("refreshRequest", memory.refreshRequest);
        }
    }
} as RefresherModule<{
    memory: {
        uuid: string | null;
        uuid2: string | null;
        cache: object;
        new_counts: 0;
        average_counts: number[];
        delay: number;
        refresh: number;
        calledByPageTurn: boolean;
        refreshRequest: string | null;
        lastRefresh: number;
        load:
            | ((customURL?: string, force?: boolean) => Promise<boolean>)
            | null;
    };
    shortcuts: {
        refreshLists(): void;
        refreshPause(): void;
    };
    settings: {
        refreshRate: RefresherRangeSettings;
        autoRate: RefresherCheckSettings;
        fadeIn: RefresherCheckSettings;
        useBetterBrowse: RefresherCheckSettings;
        noRefreshOnSearch: RefresherCheckSettings;
        doNotColorVisited: RefresherCheckSettings;
    };
    require: ["http", "eventBus", "filter"];
}>;

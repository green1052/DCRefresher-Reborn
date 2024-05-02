import * as Toast from "../components/toast";
import {queryString} from "../utils/http";
import $ from "cash-dom";
import ky from "ky";
import * as storage from "../utils/storage";

const AVERAGE_COUNTS_SIZE = 7;

let blurConfig = false;

storage.get<boolean>("컨텐츠 차단.blur").then((value) => {
    blurConfig = value;
});

let PAUSE_REFRESH = false;

const updateRefreshText = (button?: HTMLElement) => {
    button ??=
        document.querySelector<HTMLElement>(
            ".page_head .gall_issuebox button[data-refresher=true]"
        ) ?? undefined;

    if (!button) return;

    const onOff = button.querySelector<HTMLSpanElement>("span");
    (onOff as HTMLSpanElement).innerHTML = PAUSE_REFRESH ? "꺼짐" : "켜짐";
};

const addRefreshText = (issueBox: HTMLElement) => {
    const pageHead =
        issueBox ?? document.querySelector(".page_head .gall_issuebox");

    if (!pageHead?.querySelector("button[data-refresher=true]")) {
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
    url: /\/board\/(view|lists)/,
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

            this.memory.load?.();
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
        http,
        eventBus,
        filter
    ) {
        if (this.status.doNotColorVisited) {
            $(document.documentElement).addClass("refresherDoNotColorVisited");
        }

        filter.add(".page_head .gall_issuebox", (element) => {
            addRefreshText(element);
        });

        const urlSearchParams = new URLSearchParams(location.href);
        const currentPostNo = urlSearchParams.get("no");

        let originalLocation = location.href;

        if (this.status.noRefreshOnSearch && queryString("s_keyword")) {
            PAUSE_REFRESH = true;
            updateRefreshText();
        }

        this.memory.load = async (customURL?, force?): Promise<boolean> => {
            if (document.hidden) return false;

            if (
                !force &&
                (Date.now() < this.memory.lastRefresh + 500 || PAUSE_REFRESH)
            ) {
                return false;
            }

            const $userDataLyr = $("#user_data_lyr");

            if (
                $userDataLyr.length > 0 &&
                $userDataLyr.css("display") !== "none"
            )
                return false;

            const isAdmin = $(".useradmin_btnbox button").length > 0;

            if (isAdmin && $(".article_chkbox").filter(":checked").length > 0) return false;

            const managerCheckbox = $("#minor_manager_checkbox-tmpl").html();

            this.memory.lastRefresh = Date.now();
            this.memory.new_counts = 0;

            if (customURL) {
                originalLocation = customURL;
            }

            const url = http.view(originalLocation);

            const response = await ky.get(url).text();
            const dom = new DOMParser().parseFromString(response, "text/html");

            eventBus.emit("refresherGetPost", dom);

            const $newList = $(dom.querySelector(".gall_list:not([id]) tbody"));

            if ($newList.length === 0 || $newList.children().length === 0)
                return false;

            const $oldList = $(".gall_list:not([id]) tbody");

            const cached = Array.from($("tbody > tr")).map(element => element?.dataset.no || $(element).find(".gall_num").text());

            for (const element of $oldList.children()) {
                const no = String($(element).data("no")) || $(element).find(".gall_num").text();
                if (!no || !$newList.children().is(`[data-no="${no}"]`)) {
                    $(element).remove();
                }
            }

            // for (const no of $oldList.children().map((_, element) => element.dataset.no || element.querySelector(".gall_num")?.textContent)) {
            //     if (!no || $newList.children().filter((_, element) => element.dataset.no === String(no) || element.querySelector(".gall_num")?.textContent === String(no)).length) continue;
            //     $oldList.children(`tr[data-no="${no}"]`).remove();
            // }

            for (const element of Array.from($newList.children()).reverse()) {
                const $element = $(element);
                let no = $element.data("no");

                if (!no) continue;

                no = String(no);

                if (!this.memory.calledByPageTurn) {
                    if (currentPostNo === no) {
                        const $crt = $oldList.children("tr[class*=crt]");
                        $crt.children(".gall_tit").html($element.children(".gall_tit").html());
                        $crt.children(".gall_count").html($element.children(".gall_count").html());
                        $crt.children(".gall_recommend").html($element.children(".gall_recommend").html());

                        continue;
                    }

                    if (cached.includes(no)) {
                        const $old = $oldList.children().filter((_, element) => element.dataset.no === no || $(element).find(".gall_num").text() === no);

                        $old.children(".gall_tit").html($element.children(".gall_tit").html());
                        $old.children(".gall_count").html($element.children(".gall_count").html());
                        $old.children(".gall_recommend").html($element.children(".gall_recommend").html());

                        continue;
                    }
                }

                if (isAdmin) {
                    $element
                        .prepend(`<td class=gall_chk>${managerCheckbox}</td>`);
                }

                const last = $oldList.children("tr:has(em.icon_notice)").last();

                if (last.length) {
                    last.after($element);
                } else {
                    const $hope = $oldList.children(`tr[class="ub-content "]`);

                    if ($hope.length) {
                        $hope.after($element);
                    } else {
                        $oldList.prepend($element);
                    }
                }

                if (this.status.fadeIn && !this.memory.calledByPageTurn) {
                    const delay = this.memory.new_counts * 23;

                    $element
                        .addClass("refresherNewPost")
                        .css("animation-delay", `${delay}ms`);

                    setTimeout(() => {
                        $element
                            .css("animation-delay", "")
                            .removeClass("refresherNewPost");
                    }, delay + 1000);
                    this.memory.new_counts++;
                }
            }

            if (!this.memory.calledByPageTurn) {
                const averageCounts = this.memory.average_counts;
                averageCounts.push(this.memory.new_counts);

                if (averageCounts.length > AVERAGE_COUNTS_SIZE) {
                    averageCounts.shift();
                }

                const average =
                    averageCounts.reduce((a, b) => a + b) /
                    averageCounts.length;

                if (this.status.autoRate) {
                    this.memory.delay = Math.max(
                        600,
                        8 * Math.pow(2 / 3, 3 * average) * 1000
                    );
                }
            }

            this.memory.calledByPageTurn = false;

            // 검색일 경우 강조 표시 생성
            if (queryString("s_keyword")) {
                const keyword = $("input[name=s_keyword]").val() as string;

                if (keyword) {
                    for (const element of $oldList.find(".gall_tit")) {
                        const $element = $(element);

                        const $a = $element.find("a:first-child");
                        const $tmpSubject = $a.clone();

                        $tmpSubject.find(".icon_img").remove();

                        const tmpSubjectHtml = $tmpSubject.html().trim();

                        if (tmpSubjectHtml.match(keyword)) {
                            let subject = tmpSubjectHtml.replace(
                                keyword,
                                `<span class=mark>${keyword}</span>`
                            );
                            subject = $a
                                .html()
                                .replace(tmpSubjectHtml, subject);

                            $a.html(subject);
                        }
                    }
                }
            }

            eventBus.emit("refresh", $newList);

            return true;
        };

        const run = (skipLoad?: boolean) => {
            if (!skipLoad) {
                this.memory.load!();
            }

            if (!this.status.autoRate) {
                this.memory.delay = Math.max(1000, this.status.refreshRate);
            }

            if (this.memory.refresh) {
                clearTimeout(this.memory.refresh);
            }

            this.memory.refresh = window.setTimeout(run, this.memory.delay);
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

        window.addEventListener("pageshow", (ev) => {
            run(!ev.persisted);
        });

        this.memory.refreshRequest = eventBus.on("refreshRequest", () => {
            if (this.memory.refresh) {
                clearTimeout(this.memory.refresh);
            }

            this.memory.load!(undefined, true);
        });

        if (this.status.useBetterBrowse) {
            this.memory.uuid = filter.add<HTMLAnchorElement>(
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

                        this.memory.calledByPageTurn = true;

                        await this.memory.load!(location.href, true);

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
                this.memory.calledByPageTurn = true;
                this.memory.load!(undefined, true);
            });

            this.memory.uuid2 = eventBus.on(
                "refresherGetPost",
                (parsedBody: Document) => {
                    const pagingBox = parsedBody.querySelector(
                        ".left_content article:has(.gall_listwrap) .bottom_paging_box"
                    );

                    const currentBottomPagingBox = document.querySelector(
                        ".left_content article:has(.gall_listwrap) .bottom_paging_box"
                    );

                    if (currentBottomPagingBox && pagingBox) {
                        currentBottomPagingBox.innerHTML = pagingBox.innerHTML;
                    }

                    const pagingBoxAnchors =
                        document.querySelectorAll<HTMLAnchorElement>(
                            ".left_content article:has(.gall_listwrap) .bottom_paging_box a"
                        );

                    if (pagingBoxAnchors) {
                        for (const a of pagingBoxAnchors) {
                            const href = a.href;

                            if (href.includes("javascript:")) continue;

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
                                this.memory.calledByPageTurn = true;

                                await this.memory.load!(location.href, true);

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
                        }
                    }
                }
            );
        }
    },
    revoke(
        _,
        eventBus,
        filter
    ) {
        document.body.classList.remove("refresherDoNotColorVisited");

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

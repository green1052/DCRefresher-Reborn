import {pagePostNo, postSearchUrl, queryString} from "@/core/http/urls";
import {sendMessage} from "@/core/messaging/protocol";
import {useUiStore} from "@/stores/ui";

const ORIGIN_CLASS = "refresherImageOrigin";
const SEARCH_CLASS = "refresherTitleSearch";

const hexBytes = (hex: string): number[] => Array.from(hex.match(/../g) ?? [], (byte) => parseInt(byte, 16));

/** 디시 이미지 주소의 id는 올린 갤러리 아이디를 MD5("dcinside")와 XOR한 값이다. 아이디는 16자까지 담기고, 미니 갤러리는 "mi$"가 붙는다. */
const IMAGE_ID_KEY = hexBytes("4dddb04685b258c60edfb6d576b1445d");

const uploadedGallery = (src: string): string | undefined => {
    const url = URL.parse(src);
    const id = url?.hostname.startsWith("dcimg") ? url.searchParams.get("id") : null;
    return id ? String.fromCharCode(...hexBytes(id).map((byte, index) => byte ^ IMAGE_ID_KEY[index % IMAGE_ID_KEY.length]!)) : undefined;
};

/** 디시에서 받은 이미지의 파일 이름: 갤러리아이디-날짜-시각-번호(-resize).확장자. */
const DOWNLOADED_NAME = /^([a-z0-9_]+)-\d{8}-\d{6}-\d{3}(?:-resize)?\.\w+$/;

/** 다른 갤러리에서 올린 본문 이미지와, 다른 갤러리에서 받은 첨부 파일을 제목 위에 알린다. */
const showImageOrigin = (head: Element): void => {
    const gallery = queryString("id") ?? "";
    const own = new Set([gallery, `mi$${gallery}`].map((id) => id.slice(0, 16)));
    const foreign = new Map<string, string[]>();
    const check = (source: string | undefined, label: string): void => {
        if (source && !own.has(source.slice(0, 16))) foreign.set(source, [...(foreign.get(source) ?? []), label]);
    };

    const media = document.querySelectorAll<HTMLImageElement | HTMLVideoElement>(".write_div :is(img:not(.written_dccon, .og-img), video)");
    // 늦게 불러오는 이미지는 data-original, GIF를 바꾼 영상은 data-src에 주소가 있다.
    for (const [index, element] of media.entries()) check(uploadedGallery(element.dataset.original ?? element.dataset.src ?? element.src), `${index + 1}번`);
    for (const [index, item] of document.querySelectorAll(".appending_file li").entries()) {
        check(DOWNLOADED_NAME.exec(item.textContent?.trim() ?? "")?.[1], `첨부 ${index + 1}번`);
    }
    if (foreign.size === 0) return;

    const text = Array.from(foreign, ([source, labels]) => `${source}(${labels.join(", ")})`).join(" · ");
    head.prepend(Object.assign(document.createElement("p"), {className: ORIGIN_CLASS, textContent: `다른 갤러리의 이미지: ${text}`}));
};

/** 제목이 같은 글을 디시 통합검색에서 찾는다. 검색은 낱말 단위라 제목이 똑같은 글만 추리고, 이 글은 뺀다. */
const searchSameTitle = async (button: HTMLButtonElement, title: string): Promise<void> => {
    const {showToast} = useUiStore.getState();
    const openResults = {label: "검색 결과 보기", run: () => window.open(postSearchUrl(title), "_blank", "noopener")};
    button.disabled = true;
    try {
        const dom = new DOMParser().parseFromString(await sendMessage("refresher:searchPosts", title), "text/html");
        const galleries = Array.from(dom.querySelectorAll("ul.sch_result_list > li"), (item) => {
            const link = item.querySelector(".tit_txt");
            const params = URL.parse(link?.getAttribute("href") ?? "")?.searchParams;
            const self = params?.get("id") === queryString("id") && params?.get("no") === pagePostNo;
            return link?.textContent?.trim() === title && !self ? (item.querySelector(".sub_txt")?.textContent?.trim() ?? "") : null;
        }).filter((gallery) => gallery !== null);

        if (galleries.length === 0) showToast("제목이 같은 글을 찾지 못했습니다.", "info", 5000, openResults);
        else showToast(`제목이 같은 글 ${galleries.length}개: ${[...new Set(galleries)].join(", ")}`, "warning", 10_000, openResults);
    } catch (e) {
        console.error("Title search failed:", e);
        showToast("통합검색을 불러오지 못했습니다.", "error");
    } finally {
        button.disabled = false;
    }
};

const addTitleSearch = (head: Element): void => {
    const title = head.querySelector(".title_subject")?.textContent?.trim();
    const counts = head.querySelector(".gall_writer .fr");
    if (!title || !counts) return;

    const button = Object.assign(document.createElement("button"), {type: "button", className: SEARCH_CLASS, textContent: "같은 제목 찾기"});
    button.addEventListener("click", () => void searchSameTitle(button, title));
    counts.prepend(button);
};

export const removeViewTools = (): void => {
    for (const element of document.querySelectorAll(`.${ORIGIN_CLASS}, .${SEARCH_CLASS}`)) element.remove();
};

/** 글 보기 머리(.gallview_head)에 켠 도구를 다시 그린다. */
export const renderViewTools = (show: { imageOrigin: boolean; titleSearch: boolean }): void => {
    removeViewTools();
    const head = document.querySelector(".gallview_head");
    if (!head) return;
    // 개념글은 다른 갤러리의 글을 옮긴 것이라 이미지 출처는 언제나 다르다.
    if (show.imageOrigin && queryString("id") !== "dcbest") showImageOrigin(head);
    if (show.titleSearch) addTitleSearch(head);
};

import {listUrl, WRITER_PARAMS, type WriterFilter, type WriterKind} from "@/core/http/urls";

// 아이디·IP로 작성자 글 찾기. 디시 글쓴이 검색(search_name)은 닉네임만 찾고 아이디·IP로는 아무것도 나오지 않는다.
// 그래서 목록 주소에 이 값(core/http/urls.ts의 WRITER_PARAMS)을 얹어 두고 그 작성자가 아닌 행을 숨긴다.
// 닉네임을 알면 글쓴이 검색으로 범위를 넓히고, 모르면 목록을 넘기며 거른다.

/** 그 작성자의 작성자 칸 (디시 목록의 td.ub-writer[data-uid|data-ip]). */
export const writerSelector = ({kind, value}: WriterFilter): string => `.ub-writer[data-${kind}="${CSS.escape(value)}"]`;

const withFilter = (href: string, filter: WriterFilter): string => {
    const url = new URL(href);
    url.searchParams.set(WRITER_PARAMS[filter.kind], filter.value);
    return url.href;
};

/**
 * 이 갤러리 목록에서 그 작성자의 글을 찾는 주소. nick을 주면 디시 글쓴이 검색으로 찾고, 없으면 목록 1쪽부터 거른다.
 * filter가 null이면 거르지 않고 닉네임으로만 찾는다 (디시 글쓴이 검색 그대로).
 */
export const writerSearchUrl = (filter: WriterFilter | null, nick?: string): string => {
    const url = new URL(listUrl(location.href));
    for (const key of ["page", "s_type", "s_keyword", "search_pos", "search_head", "exception_mode"]) url.searchParams.delete(key);
    if (nick) {
        url.searchParams.set("s_type", "search_name");
        url.searchParams.set("s_keyword", nick);
    }
    return filter ? withFilter(url.href, filter) : url.href;
};

/** 페이징 링크에도 작성자 거르기를 얹는다. 디시가 만든 링크에는 없어 다음 쪽에서 풀린다. */
export const keepWriterFilter = (paging: Element, filter: WriterFilter): void => {
    for (const anchor of paging.querySelectorAll<HTMLAnchorElement>("a[href]")) {
        // 디시 링크는 상대 주소다. href는 절대 주소로 풀린 값이고, javascript: 링크는 건드리지 않는다.
        if (anchor.href.startsWith("http")) anchor.href = withFilter(anchor.href, filter);
    }
};

const TYPE_NAMES: Record<WriterKind, string> = {uid: "아이디", ip: "IP"};
const ADDED_TYPE = "refresherWriterType";

/**
 * 갤러리 검색창의 종류(글쓴이 등)에 아이디·IP를 더한다. 고르고 검색하면 디시 검색 대신 search를 부른다.
 * 이 페이지가 작성자 거르기 중이면 그 종류와 값을 채워 둔다.
 */
export const addWriterTypes = (filter: WriterFilter | null, search: (filter: WriterFilter) => void, signal: AbortSignal): void => {
    const layer = document.querySelector<HTMLElement>("#searchTypeLayer");
    const label = document.querySelector("#search_type_txt");
    const input = document.querySelector<HTMLInputElement>(".bottom_search input[name='search_keyword']");
    const button = document.querySelector(".bottom_search .bnt_search");
    if (!layer || !label || !input || !button) return;

    for (const kind of ["uid", "ip"] as const) {
        const item = Object.assign(document.createElement("li"), {textContent: TYPE_NAMES[kind], className: ADDED_TYPE});
        item.dataset.kind = kind;
        layer.append(item);
    }

    let chosen = filter?.kind ?? null;
    if (filter) {
        label.textContent = TYPE_NAMES[filter.kind];
        input.value = filter.value;
    }

    // 디시 종류를 고르면 디시 검색으로 돌아간다. 디시 쪽 처리기(searchTypeSel)가 이름을 바꾼다.
    layer.addEventListener("click", (ev) => {
        const item = ev.target instanceof Element ? ev.target.closest("li") : null;
        if (!item) return;
        const kind = item.dataset.kind;
        chosen = kind === "uid" || kind === "ip" ? kind : null;
        if (!chosen) return;
        label.textContent = TYPE_NAMES[chosen];
        layer.style.display = "none";
    }, {signal});

    // 디시의 검색 버튼·입력칸 처리기보다 먼저 받아 막는다.
    const submit = (ev: Event): void => {
        if (!chosen) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        search({kind: chosen, value: input.value.trim()});
    };
    button.addEventListener("click", submit, {capture: true, signal});
    input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && !ev.isComposing) submit(ev);
    }, {capture: true, signal});
};

/** 검색창에 더한 종류를 뺀다 (모듈을 끌 때). */
export const removeWriterTypes = (): void => {
    for (const item of document.querySelectorAll(`.${ADDED_TYPE}`)) item.remove();
};

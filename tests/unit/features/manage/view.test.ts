// @vitest-environment-options {"url": "https://gall.dcinside.com/board/view/?id=test&no=10"}
import {createHash} from "node:crypto";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {removeViewTools, renderViewTools} from "@/features/manage/view";
import {useUiStore} from "@/stores/ui";

const sendMessage = vi.hoisted(() => vi.fn<(type: string, title: string) => Promise<string>>());
vi.mock("@/core/messaging/protocol", () => ({sendMessage}));

/** 디시 이미지 주소의 id: 올린 갤러리 아이디를 MD5("dcinside")와 XOR한 16진수. */
const imageId = (gallery: string): string => {
    const key = createHash("md5").update("dcinside").digest();
    return Array.from(gallery, (char, index) => (char.charCodeAt(0) ^ key[index % key.length]!).toString(16).padStart(2, "0")).join("");
};
const image = (gallery: string): string => `https://dcimg8.dcinside.co.kr/viewimage.php?id=${imageId(gallery)}&no=1`;

const HEAD = "<div class=\"gallview_head\"><h3><span class=\"title_subject\"> 같은 제목 </span></h3><div class=\"gall_writer\"><div class=\"fr\"><span>조회</span></div></div></div>";

const mount = (body = "", files: string[] = []): void => {
    document.body.innerHTML = `${HEAD}<div class="write_div">${body}</div><ul class="appending_file">${files.map((name) => `<li><a>${name}</a></li>`).join("")}</ul>`;
};

const origin = (): string | undefined => document.querySelector(".gallview_head > .refresherImageOrigin")?.textContent ?? undefined;

beforeEach(() => {
    history.replaceState(null, "", "/board/view/?id=test&no=10");
    useUiStore.setState({toasts: []});
});

afterEach(() => {
    document.body.innerHTML = "";
});

describe("이미지 출처", () => {
    it("다른 갤러리에서 올린 본문 이미지를 번호와 함께 알린다", () => {
        mount(`<img src="${image("other")}"><img src="${image("test")}"><img data-original="${image("other")}" src="lazy.gif"><video data-src="${image("third")}"></video>`);
        renderViewTools({imageOrigin: true, titleSearch: false});
        expect(origin()).toBe("다른 갤러리의 이미지: other(1번, 3번) · third(4번)");
    });

    it("미니 갤러리 접두사와 16자 넘는 아이디는 같은 갤러리로 본다", () => {
        history.replaceState(null, "", "/board/view/?id=averyveryverylonggallery&no=10");
        mount(`<img src="${image("mi$averyveryverylonggallery".slice(0, 16))}"><img src="${image("averyveryverylonggallery".slice(0, 16))}">`);
        renderViewTools({imageOrigin: true, titleSearch: false});
        expect(origin()).toBeUndefined();
    });

    it("디시콘·링크 미리보기 이미지와 디시 이미지가 아닌 것은 보지 않는다", () => {
        mount(`<img class="written_dccon" src="${image("other")}"><img class="og-img" src="${image("other")}"><img src="https://example.com/a.png?id=${imageId("other")}">`);
        renderViewTools({imageOrigin: true, titleSearch: false});
        expect(origin()).toBeUndefined();
    });

    it("다른 갤러리에서 받은 첨부 파일을 알린다", () => {
        mount("", ["other-20240101-123456-001.jpg", "test-20240101-123456-002-resize.png", "그냥 파일.jpg"]);
        renderViewTools({imageOrigin: true, titleSearch: false});
        expect(origin()).toBe("다른 갤러리의 이미지: other(첨부 1번)");
    });

    it("개념글에서는 알리지 않는다", () => {
        history.replaceState(null, "", "/board/view/?id=dcbest&no=10");
        mount(`<img src="${image("other")}">`);
        renderViewTools({imageOrigin: true, titleSearch: false});
        expect(origin()).toBeUndefined();
    });

    it("다시 그려도 쌓이지 않고 removeViewTools로 뗀다", () => {
        mount(`<img src="${image("other")}">`);
        renderViewTools({imageOrigin: true, titleSearch: true});
        renderViewTools({imageOrigin: true, titleSearch: true});
        expect(document.querySelectorAll(".refresherImageOrigin, .refresherTitleSearch")).toHaveLength(2);
        removeViewTools();
        expect(document.querySelectorAll(".refresherImageOrigin, .refresherTitleSearch")).toHaveLength(0);
    });
});

describe("같은 제목 찾기", () => {
    const result = (title: string, gallery: string, href: string): string =>
        `<li><a class="tit_txt" href="${href}">${title}</a><span class="sub_txt">${gallery}</span></li>`;
    const results = (items: string[]): string => `<ul class="sch_result_list">${items.join("")}</ul>`;

    const search = async (): Promise<HTMLButtonElement> => {
        mount();
        renderViewTools({imageOrigin: false, titleSearch: true});
        const button = document.querySelector<HTMLButtonElement>(".gall_writer .fr > .refresherTitleSearch")!;
        button.click();
        expect(button.disabled).toBe(true);
        await vi.waitFor(() => expect(button.disabled).toBe(false));
        return button;
    };

    it("제목이 똑같은 다른 글의 갤러리를 알린다", async () => {
        sendMessage.mockResolvedValue(results([
            result("같은 제목", "A갤", "https://gall.dcinside.com/board/view/?id=a&no=1"),
            result("같은 제목", "A갤", "https://gall.dcinside.com/board/view/?id=a&no=2"),
            result("같은 제목 아님", "B갤", "https://gall.dcinside.com/board/view/?id=b&no=1"),
            result("같은 제목", "이 글", "https://gall.dcinside.com/board/view/?id=test&no=10")
        ]));
        await search();
        expect(sendMessage).toHaveBeenCalledWith("refresher:searchPosts", "같은 제목");
        const toast = useUiStore.getState().toasts.at(-1);
        expect(toast?.content).toBe("제목이 같은 글 2개: A갤");
        expect(toast?.type).toBe("warning");
        expect(toast?.action?.label).toBe("검색 결과 보기");
    });

    it("없으면 찾지 못했다고 알린다", async () => {
        sendMessage.mockResolvedValue(results([]));
        await search();
        expect(useUiStore.getState().toasts.at(-1)?.content).toBe("제목이 같은 글을 찾지 못했습니다.");
    });

    it("검색이 실패하면 오류를 알린다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        sendMessage.mockRejectedValue(new Error("실패"));
        await search();
        expect(useUiStore.getState().toasts.at(-1)).toMatchObject({content: "통합검색을 불러오지 못했습니다.", type: "error"});
    });
});

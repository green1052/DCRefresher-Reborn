/**
 * @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
 */
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {BLOCKED_TEXT} from "@/core/block";
import type {GalleryPreData, PostInfo} from "@/core/preview/types";
import {createMini} from "@/features/preview/mini";
import {MINI_WIDTH, usePreviewStore} from "@/features/preview/ui/previewStore";
import {type BlockView, useUiStore} from "@/stores/ui";

import {fakeCtx} from "./ctx";
import {renderList, type Row, rowOf} from "./list";

const initialPreview = usePreviewStore.getState();
beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("innerWidth", 2000);
    vi.stubGlobal("innerHeight", 1000);
    usePreviewStore.setState(initialPreview, true);
    useUiStore.setState({blockView: null});
});
afterEach(() => vi.unstubAllGlobals());

const blockView = (revealed: boolean): BlockView => ({blur: true, blurReveal: false, replyRemove: false, revealed, duplicate: null});

const postOf = (fields: Partial<PostInfo> = {}): PostInfo => ({title: "제목", contents: "<p>본문</p>", commentForm: {fields: [], serviceCode: "", checks: {}}, ...fields});

const start = (settings: Parameters<typeof fakeCtx>[0] = {}, post: PostInfo = postOf()) => {
    const {ctx} = fakeCtx({tooltipMode: true, tooltipDelay: 300, ...settings});
    const getPost = vi.fn(async (_pre: GalleryPreData) => ({post}));
    const processContents = vi.fn(async (_pre: GalleryPreData, value: PostInfo, _strip?: boolean) => value);
    return {mini: createMini(ctx, getPost, processContents), getPost, processContents};
};

const titleOf = (rows: Row[], no = rows[0]?.no ?? 0): HTMLElement => {
    const word = rowOf(renderList(rows), no).querySelector<HTMLElement>(".ub-word");
    if (!word) throw new Error("제목 칸이 없다");
    return word;
};

const mouse = (clientX: number, clientY: number) => new MouseEvent("mouseover", {clientX, clientY});
const shown = () => usePreviewStore.getState().mini;

describe("createMini", () => {
    it("머문 뒤에 본문을 받아 띄운다", async () => {
        const {mini, getPost, processContents} = start({tooltipMediaHide: true});
        mini.onMiniEnter(titleOf([{no: 1}]), mouse(100, 200));
        await vi.advanceTimersByTimeAsync(299);
        expect(getPost).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(getPost.mock.calls[0]?.[0].id).toBe("1");
        expect(processContents.mock.calls[0]?.[2]).toBe(true);
        expect(shown()).toEqual({x: 116, y: 216, title: "제목", contents: "<p>본문</p>", blockMedia: false, interactive: false, gallery: "test"});
    });

    it("꺼져 있으면 띄우지 않는다", async () => {
        const {mini, getPost} = start({tooltipMode: false});
        mini.onMiniEnter(titleOf([{no: 1}]), mouse(0, 0));
        await vi.advanceTimersByTimeAsync(1000);
        expect(getPost).not.toHaveBeenCalled();
    });

    it("지연 전에 떠나면 받지 않는다", async () => {
        const {mini, getPost} = start();
        mini.onMiniEnter(titleOf([{no: 1}]), mouse(0, 0));
        mini.onMiniLeave();
        await vi.advanceTimersByTimeAsync(1000);
        expect(getPost).not.toHaveBeenCalled();
    });

    it("받는 사이 떠나면 띄우지 않는다", async () => {
        const {ctx} = fakeCtx({tooltipMode: true});
        let resolve = (_value: { post: PostInfo }): void => undefined;
        const mini = createMini(ctx, () => new Promise((done) => (resolve = done)), async (_pre, post) => post);
        mini.onMiniEnter(titleOf([{no: 1}]), mouse(0, 0));
        await vi.advanceTimersByTimeAsync(300);
        mini.onMiniLeave();
        resolve({post: postOf()});
        await vi.advanceTimersByTimeAsync(0);
        expect(shown()).toBeNull();
    });

    it("전체 미리보기가 열려 있으면 띄우지 않는다", async () => {
        const {mini, getPost} = start();
        usePreviewStore.setState({visible: true});
        mini.onMiniEnter(titleOf([{no: 1}]), mouse(0, 0));
        await vi.advanceTimersByTimeAsync(1000);
        expect(getPost).not.toHaveBeenCalled();
    });

    it("받는 사이 전체 미리보기가 열리면 띄우지 않는다", async () => {
        const {mini} = start();
        mini.onMiniEnter(titleOf([{no: 1}]), mouse(0, 0));
        await vi.advanceTimersByTimeAsync(299);
        usePreviewStore.setState({visible: true});
        await vi.advanceTimersByTimeAsync(1);
        expect(shown()).toBeNull();
    });

    it("받지 못하면 띄우지 않는다", async () => {
        const {ctx} = fakeCtx({tooltipMode: true});
        const mini = createMini(ctx, async () => Promise.reject(new Error("x")), async (_pre, post) => post);
        mini.onMiniEnter(titleOf([{no: 1}]), mouse(0, 0));
        await vi.advanceTimersByTimeAsync(300);
        expect(shown()).toBeNull();
    });

    it("블러 행은 띄우지 않는다", async () => {
        useUiStore.setState({blockView: blockView(false)});
        const {mini, getPost} = start();
        mini.onMiniEnter(titleOf([{no: 1, className: "refresherBlur"}]), mouse(0, 0));
        await vi.advanceTimersByTimeAsync(1000);
        expect(getPost).not.toHaveBeenCalled();
    });

    it("차단된 본문은 안내 문구로 가린다", async () => {
        useUiStore.setState({blockView: blockView(false)});
        const {mini} = start({}, postOf({textBlocked: "blur"}));
        mini.onMiniEnter(titleOf([{no: 1}]), mouse(0, 0));
        await vi.advanceTimersByTimeAsync(300);
        expect(shown()?.contents).toBe(BLOCKED_TEXT);
    });

    it("가린 내용 보기 중이면 본문을 보인다", async () => {
        useUiStore.setState({blockView: blockView(true)});
        const {mini} = start({}, postOf({textBlocked: "hide"}));
        mini.onMiniEnter(titleOf([{no: 1}]), mouse(0, 0));
        await vi.advanceTimersByTimeAsync(300);
        expect(shown()?.contents).toBe("<p>본문</p>");
    });

    it("이미지 아이콘 없는 글만 이미지를 가린다", async () => {
        const {mini} = start({blockImage: true});
        mini.onMiniEnter(titleOf([{no: 1, icon: "icon_txt"}]), mouse(0, 0));
        await vi.advanceTimersByTimeAsync(300);
        expect(shown()?.blockMedia).toBe(true);
        mini.onMiniLeave();
        mini.onMiniEnter(titleOf([{no: 2, icon: "icon_pic"}]), mouse(0, 0));
        await vi.advanceTimersByTimeAsync(300);
        expect(shown()?.blockMedia).toBe(false);
    });

    it("조작할 수 있는 미니는 커서 바로 오른쪽에 둔다", async () => {
        const {mini} = start({tooltipInteraction: true});
        mini.onMiniEnter(titleOf([{no: 1}]), mouse(100, 200));
        await vi.advanceTimersByTimeAsync(300);
        expect(shown()).toMatchObject({x: 110, y: 150, interactive: true});
    });

    it("오른쪽에 자리가 없으면 커서 왼쪽에 둔다", async () => {
        const {mini} = start({tooltipInteraction: true});
        mini.onMiniEnter(titleOf([{no: 1}]), mouse(1900, 200));
        await vi.advanceTimersByTimeAsync(300);
        expect(shown()?.x).toBe(1900 - MINI_WIDTH - 10);
    });

    it("커서를 따라간다", async () => {
        const {mini} = start();
        mini.onMiniEnter(titleOf([{no: 1}]), mouse(0, 0));
        await vi.advanceTimersByTimeAsync(300);
        mini.onMiniMove(new MouseEvent("mousemove", {clientX: 50, clientY: 60}));
        expect(shown()).toMatchObject({x: 66, y: 76});
    });

    it("조작할 수 있는 미니는 따라가지 않는다", async () => {
        const {mini} = start({tooltipInteraction: true});
        mini.onMiniEnter(titleOf([{no: 1}]), mouse(100, 200));
        await vi.advanceTimersByTimeAsync(300);
        mini.onMiniMove(new MouseEvent("mousemove", {clientX: 500, clientY: 500}));
        expect(shown()).toMatchObject({x: 110, y: 150});
    });

    it("떠나면 바로 닫는다", async () => {
        const {mini} = start();
        mini.onMiniEnter(titleOf([{no: 1}]), mouse(0, 0));
        await vi.advanceTimersByTimeAsync(300);
        mini.onMiniLeaveSoon();
        expect(shown()).toBeNull();
    });

    it("조작할 수 있는 미니는 조금 뒤에 닫고 돌아오면 남긴다", async () => {
        const {mini} = start({tooltipInteraction: true});
        const title = titleOf([{no: 1}]);
        mini.onMiniEnter(title, mouse(0, 0));
        await vi.advanceTimersByTimeAsync(300);
        mini.onMiniLeaveSoon();
        await vi.advanceTimersByTimeAsync(100);
        mini.onMiniEnter(title, mouse(0, 0));
        await vi.advanceTimersByTimeAsync(100);
        expect(shown()).not.toBeNull();
        mini.onMiniLeaveSoon();
        await vi.advanceTimersByTimeAsync(150);
        expect(shown()).toBeNull();
    });

    it("다른 제목에 들어가면 앞 글 카드를 바로 내린다", async () => {
        const {mini} = start({tooltipInteraction: true});
        renderList([{no: 1}, {no: 2}]);
        const [first, second] = document.querySelectorAll<HTMLElement>(".ub-word");
        if (!first || !second) throw new Error("제목 칸이 없다");
        mini.onMiniEnter(first, mouse(0, 0));
        await vi.advanceTimersByTimeAsync(300);
        mini.onMiniLeaveSoon();
        mini.onMiniEnter(second, mouse(0, 0));
        expect(shown()).toBeNull();
        await vi.advanceTimersByTimeAsync(300);
        expect(shown()?.title).toBe("제목");
    });
});

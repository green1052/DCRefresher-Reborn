import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {overlayNeeded} from "@/components/overlay/demands";
import {closeMiniSoon, hoverMini, keepMini, MINI_HEIGHT, MINI_WIDTH, miniPosition, NO_REPLY, parseDate, postTitle, usePreviewStore} from "@/features/preview/ui/previewStore";

import {preData} from "../../../../helpers";

const initial = usePreviewStore.getState();
beforeEach(() => usePreviewStore.setState(initial, true));
afterEach(() => vi.unstubAllGlobals());

const mini = {x: 0, y: 0, title: "", contents: "", blockMedia: false, interactive: true, gallery: "test"};

describe("open", () => {
    it("글 상태를 비우고 patch를 얹어 연다", () => {
        usePreviewStore.setState({error: {detail: "x"}, collapsed: new Set(["1"]), notice: true, mini, dcconInfo: "c"});
        const before = usePreviewStore.getState().signalId;
        usePreviewStore.getState().open(preData({id: "5"}), {commentsOnly: true});
        const state = usePreviewStore.getState();
        expect(state).toMatchObject({visible: true, fading: false, commentsOnly: true, error: undefined, notice: false, mini: null, dcconInfo: null});
        expect(state.preData?.id).toBe("5");
        expect(state.collapsed.size).toBe(0);
        expect(state.signalId).toBeGreaterThan(before);
    });

    it("이전 글의 캡차를 빈 코드로 닫는다", async () => {
        const code = usePreviewStore.getState().openCaptcha("https://captcha");
        expect(usePreviewStore.getState().captcha?.url).toBe("https://captcha");
        usePreviewStore.getState().open(preData());
        expect(await code).toBe("");
        expect(usePreviewStore.getState().captcha).toBeNull();
    });
});

describe("close", () => {
    it("닫고 200ms 동안 페이드한다", () => {
        vi.useFakeTimers();
        const store = usePreviewStore.getState();
        store.open(preData());
        usePreviewStore.setState({reply: {commentNo: "1", replyNo: "2"}, blockPopup: true, viewer: {images: [], index: 0}});
        const opened = usePreviewStore.getState().signalId;
        store.close();
        expect(usePreviewStore.getState()).toMatchObject({visible: false, fading: true, comments: undefined, blockPopup: false, reply: NO_REPLY, viewer: null});
        expect(usePreviewStore.getState().signalId).toBeGreaterThan(opened);
        vi.advanceTimersByTime(199);
        expect(usePreviewStore.getState().fading).toBe(true);
        vi.advanceTimersByTime(1);
        expect(usePreviewStore.getState().fading).toBe(false);
    });

    it("다시 닫으면 페이드를 처음부터 잰다", () => {
        vi.useFakeTimers();
        const store = usePreviewStore.getState();
        store.open(preData());
        store.close();
        vi.advanceTimersByTime(150);
        store.open(preData());
        store.close();
        vi.advanceTimersByTime(150);
        expect(usePreviewStore.getState().fading).toBe(true);
    });

    it("열려 있지 않으면 아무것도 하지 않는다", () => {
        const before = usePreviewStore.getState();
        before.close();
        expect(usePreviewStore.getState()).toBe(before);
    });

    it("캡차를 빈 코드로 닫는다", async () => {
        const store = usePreviewStore.getState();
        store.open(preData());
        const code = store.openCaptcha("u");
        store.close();
        expect(await code).toBe("");
    });
});

describe("toggleCollapse", () => {
    it("접고 편다", () => {
        const {toggleCollapse} = usePreviewStore.getState();
        toggleCollapse("1");
        const collapsed = usePreviewStore.getState().collapsed;
        expect([...collapsed]).toEqual(["1"]);
        toggleCollapse("1");
        expect(usePreviewStore.getState().collapsed.size).toBe(0);
        // 새 집합이라 구독자가 바뀐 것을 안다.
        expect(usePreviewStore.getState().collapsed).not.toBe(collapsed);
    });
});

describe("미니", () => {
    it("커서 오른쪽 아래에 두되 화면 밖으로 나가지 않는다", () => {
        vi.stubGlobal("innerWidth", 2000);
        vi.stubGlobal("innerHeight", 1000);
        expect(miniPosition(100, 100)).toEqual({x: 116, y: 116});
        expect(miniPosition(1900, 900)).toEqual({x: 2000 - MINI_WIDTH - 20, y: 1000 - MINI_HEIGHT - 20});
        vi.stubGlobal("innerWidth", 500);
        expect(miniPosition(100, 100).x).toBe(0);
    });

    it("moveMini는 떠 있을 때만 옮긴다", () => {
        vi.stubGlobal("innerWidth", 2000);
        vi.stubGlobal("innerHeight", 1000);
        const before = usePreviewStore.getState();
        before.moveMini(10, 10);
        expect(usePreviewStore.getState().mini).toBeNull();
        usePreviewStore.setState({mini});
        usePreviewStore.getState().moveMini(10, 20);
        expect(usePreviewStore.getState().mini).toMatchObject({x: 26, y: 36, title: ""});
    });

    it("closeMiniSoon은 150ms 뒤에 닫고 keepMini가 취소한다", () => {
        vi.useFakeTimers();
        hoverMini();
        usePreviewStore.setState({mini});
        closeMiniSoon();
        vi.advanceTimersByTime(149);
        keepMini();
        vi.advanceTimersByTime(10);
        expect(usePreviewStore.getState().mini).not.toBeNull();
        closeMiniSoon();
        vi.advanceTimersByTime(150);
        expect(usePreviewStore.getState().mini).toBeNull();
    });

    it("카드 위에 커서가 있으면 닫지 않는다", () => {
        vi.useFakeTimers();
        usePreviewStore.setState({mini});
        hoverMini(true);
        closeMiniSoon();
        vi.advanceTimersByTime(500);
        expect(usePreviewStore.getState().mini).not.toBeNull();
        // 카드에서 나가면 닫는다.
        hoverMini(false);
        vi.advanceTimersByTime(150);
        expect(usePreviewStore.getState().mini).toBeNull();
    });
});

describe("parseDate", () => {
    it("한국 시간으로 읽는다", () => {
        expect(parseDate("2026.09.26 02:29:40").toISOString()).toBe("2026-09-25T17:29:40.000Z");
        expect(parseDate("2026-09-26 02:29:40").toISOString()).toBe("2026-09-25T17:29:40.000Z");
    });

    it("빠진 연도는 한국 날짜의 연도로 채운다", () => {
        // UTC로는 아직 12월 31일이지만 한국은 이미 새해다.
        vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 11, 31, 16));
        expect(parseDate("01.01 00:30:00").toISOString()).toBe("2026-12-31T15:30:00.000Z");
    });
});

describe("postTitle", () => {
    it("말머리가 있으면 앞에 붙인다", () => {
        expect(postTitle({title: "제목", header: "잡담", commentForm: {fields: [], serviceCode: "", checks: {}}})).toBe("[잡담] 제목");
        expect(postTitle({title: "제목", commentForm: {fields: [], serviceCode: "", checks: {}}})).toBe("제목");
        expect(postTitle({commentForm: {fields: [], serviceCode: "", checks: {}}})).toBe("");
    });
});

describe("오버레이 조건", () => {
    it("미리보기 UI가 떠 있으면 오버레이가 필요하다", () => {
        expect(overlayNeeded()).toBe(false);
        for (const patch of [{visible: true}, {warm: true}, {mini}, {blockPopup: true}, {dcconInfo: "c"}]) {
            usePreviewStore.setState(patch);
            expect(overlayNeeded()).toBe(true);
            usePreviewStore.setState(initial, true);
        }
    });
});

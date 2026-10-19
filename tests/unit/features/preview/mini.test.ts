// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {settingsOf} from "@/core/module/settings";
import type {PostInfo} from "@/core/preview/types";
import {type Ctx, settings} from "@/features/preview/meta";
import {createMini} from "@/features/preview/mini";
import {bindRows} from "@/features/preview/rows-input";
import {usePreviewStore} from "@/features/preview/ui/previewStore";

let controller: AbortController;

beforeEach(() => {
    vi.useFakeTimers();
    controller = new AbortController();
    Object.defineProperty(window, "innerWidth", {value: 1920, configurable: true});
    document.body.innerHTML = `<table class="gall_list"><tbody><tr class="ub-content">
<td class="gall_tit ub-word"><a class="title" href="/board/view/?id=test&no=7&page=1">제목</a></td>
</tr></tbody></table>`;
});

afterEach(() => {
    controller.abort();
    usePreviewStore.setState({mini: null});
});

describe("createMini", () => {
    it("조작할 수 있는 미니는 들어온 자리가 아니라 지연 시간 뒤의 커서 오른쪽에 뜬다", async () => {
        // settingsOf는 스키마 키로 값을 채우지만 타입은 Record라 meta의 설정 타입으로 되찾는다.
        const values = {...settingsOf({settings}, {}), tooltipMode: true, tooltipInteraction: true} as Ctx["settings"];
        const ctx: Ctx = {settings: values, signal: controller.signal, addFilter: () => () => undefined, addCleanup: () => undefined, onSettingsChanged: () => undefined, onRevoke: () => undefined};
        const post: PostInfo = {title: "제목", contents: "본문", commentForm: {fields: [], serviceCode: "", checks: {}}};
        const mini = createMini(ctx, async () => ({post}), async (_preData, p) => p);
        bindRows(ctx, {open: vi.fn(), prefetch: vi.fn(), mini});

        const title = document.querySelector<HTMLElement>("a.title")!;
        title.dispatchEvent(new MouseEvent("mouseover", {bubbles: true, clientX: 100, clientY: 300}));
        title.dispatchEvent(new MouseEvent("mousemove", {bubbles: true, clientX: 600, clientY: 300}));
        await vi.advanceTimersByTimeAsync(ctx.settings.tooltipDelay);

        expect(usePreviewStore.getState().mini).toMatchObject({x: 610, interactive: true});
    });
});

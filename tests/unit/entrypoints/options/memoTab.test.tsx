import {render} from "preact";
import {act} from "preact/test-utils";
import type {ReactNode} from "react";
import {afterEach, describe, expect, it, vi} from "vitest";

import {MemoTab} from "@/entrypoints/options/MemoTab";
import {useMemosStore} from "@/stores/memos";

vi.mock("@/core/messaging/protocol", () => ({sendMessage: vi.fn(async () => ({}))}));
// 목록 화면(Base UI) 대신 UID 메모의 행 머리만 그린다.
vi.mock("@/entrypoints/options/ListTabs", () => ({
    ListTabs: ({items, row}: { items: (type: "UID") => [string, unknown][]; row: (type: "UID", item: [string, unknown], remove: () => void) => ReactNode }) =>
        <>{items("UID").map((item) => row("UID", item, () => undefined))}</>,
    ListRow: ({head}: { head: ReactNode }) => <div>{head}</div>
}));

const root = document.createElement("div");

afterEach(() => render(null, root));

const dotOf = async (color: string): Promise<HTMLElement> => {
    useMemosStore.setState({memos: {UID: {a: {text: "메모", color}}, NICK: {}, IP: {}}});
    await act(() => render(<MemoTab/>, root));
    return root.querySelector<HTMLElement>(".rounded-full")!;
};

describe("메모 탭의 색 점", () => {
    it("메모 색을 배경색으로 그린다", async () => {
        expect((await dotOf("#ff0000")).style.backgroundColor).toBe("rgb(255, 0, 0)");
    });

    it("가져온 메모 색의 url(…)을 배경 이미지로 불러오지 않는다", async () => {
        const dot = await dotOf("url(https://example.com/x.png)");
        expect(dot.style.backgroundImage).toBe("");
        expect(dot.getAttribute("style") ?? "").not.toContain("url(");
    });
});

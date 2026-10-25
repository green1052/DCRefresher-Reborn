import {render, act} from "@/tests/helpers";
import type {ReactNode} from "react";
import {afterEach, describe, expect, it, vi} from "vitest";

import {MemoTab} from "@/entrypoints/options/tabs/MemoTab";
import {useMemosStore} from "@/stores/memos";

vi.mock("@/core/messaging/protocol", () => ({sendMessage: vi.fn(async () => ({}))}));
type ImportData = (parsed: Record<string, unknown>) => Promise<number>;
const captured = vi.hoisted(() => ({importData: undefined as ImportData | undefined}));
// 목록 화면(Base UI) 대신 UID 메모의 행 머리만 그리고 가져오기 함수를 잡아 둔다.
vi.mock("@/entrypoints/options/lists/ListTabs", () => ({
    ListTabs: ({items, row, importData}: { items: (type: "UID") => [string, unknown][]; row: (type: "UID", item: [string, unknown], remove: () => void) => ReactNode; importData: ImportData }) => {
        captured.importData = importData;
        return <>{items("UID").map((item) => row("UID", item, () => undefined))}</>;
    },
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

describe("메모 목록 순서", () => {
    it("저장소 키 순서가 아니라 추가 시각 순서로 준다 (시각 없는 옛 메모가 먼저)", async () => {
        useMemosStore.setState({memos: {UID: {a: {text: "늦게", color: "#000", added: 2}, z: {text: "먼저", color: "#000", added: 1}, old: {text: "옛", color: "#000"}}, NICK: {}, IP: {}}});
        await act(() => render(<MemoTab/>, root));
        expect([...root.querySelectorAll(".font-medium")].map((el) => el.textContent)).toEqual(["old", "z", "a"]);
    });
});

describe("메모 가져오기", () => {
    const importMemos = async (parsed: Record<string, unknown>): Promise<{ count: number; updateMemos: ReturnType<typeof vi.fn> }> => {
        const updateMemos = vi.fn(async () => undefined);
        useMemosStore.setState({memos: {UID: {}, NICK: {}, IP: {}}, updateMemos});
        await act(() => render(<MemoTab/>, root));
        return {count: await captured.importData!(parsed), updateMemos};
    };

    it("유효한 메모 수를 돌려준다", async () => {
        const {count, updateMemos} = await importMemos({UID: {a: {text: "메모", color: "#ff0000"}, b: "틀림"}, IP: {"1.2": {text: "아이피", color: "#00ff00"}}});
        expect(count).toBe(2);
        expect(updateMemos).toHaveBeenCalledTimes(2);
    });

    it("메모가 모두 틀리면 0을 돌려주고 쓰지 않는다", async () => {
        const {count, updateMemos} = await importMemos({UID: {a: "메모"}, NICK: ["닉"]});
        expect(count).toBe(0);
        expect(updateMemos).not.toHaveBeenCalled();
    });
});

import {render, act} from "@/tests/helpers";
import {afterEach, describe, expect, it, vi} from "vitest";

import {BlockTab} from "@/entrypoints/options/BlockTab";
import {useBlocksStore} from "@/stores/blocks";

type ImportData = (parsed: Record<string, unknown>) => Promise<number>;
const captured = vi.hoisted(() => ({importData: undefined as ImportData | undefined}));

vi.mock("@/core/messaging/protocol", () => ({sendMessage: vi.fn(async () => ({}))}));
// 목록 화면(Base UI)은 그리지 않고 가져오기 함수만 잡아 둔다.
vi.mock("@/entrypoints/options/ListTabs", () => ({
    ListTabs: ({importData}: { importData: ImportData }) => {
        captured.importData = importData;
        return null;
    },
    ListRow: () => null
}));

const root = document.createElement("div");

afterEach(() => render(null, root));

const importBlocks = async (parsed: Record<string, unknown>): Promise<{ count: number; addEntries: ReturnType<typeof vi.fn> }> => {
    const addEntries = vi.fn(async () => undefined);
    useBlocksStore.setState({addEntries});
    await act(() => render(<BlockTab/>, root));
    return {count: await captured.importData!(parsed), addEntries};
};

describe("차단 목록 가져오기", () => {
    it("유효한 항목 수를 돌려주고 빈 종류는 쓰지 않는다", async () => {
        const {count, addEntries} = await importBlocks({NICK: [{content: "닉", isRegex: false}, {content: "틀림"}], IP: []});
        expect(count).toBe(1);
        expect(addEntries).toHaveBeenCalledTimes(1);
        expect(addEntries).toHaveBeenCalledWith("NICK", [expect.objectContaining({content: "닉"})]);
    });

    it("항목이 모두 틀리면 0을 돌려주고 쓰지 않는다", async () => {
        const {count, addEntries} = await importBlocks({NICK: [{content: "닉"}], UID: {a: "메모"}});
        expect(count).toBe(0);
        expect(addEntries).not.toHaveBeenCalled();
    });
});

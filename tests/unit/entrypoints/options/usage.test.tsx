import {render} from "preact";
import {act} from "preact/test-utils";
import {afterEach, describe, expect, it, vi} from "vitest";

import {BlockTab} from "@/entrypoints/options/BlockTab";
import {MemoTab} from "@/entrypoints/options/MemoTab";

import {tick} from "../../../helpers";

const sendMessage = vi.hoisted(() => vi.fn());
vi.mock("@/core/messaging/protocol", () => ({sendMessage}));
// 목록 화면(Base UI)은 그리지 않는다. 탭이 useUsage에 넘기는 ids만 본다.
vi.mock("@/entrypoints/options/ListTabs", () => ({ListTabs: () => null, ListRow: () => null}));

const root = document.createElement("div");

afterEach(() => render(null, root));

describe("옵션 탭의 사용 기록", () => {
    it.each([["차단", BlockTab], ["메모", MemoTab]])("%s 탭은 목록이 그대로면 기록을 한 번만 맞춘다", async (_name, Tab) => {
        // 배경은 매번 새 객체로 답한다 (메시지는 직렬화를 거친다).
        sendMessage.mockImplementation(async () => ({}));
        await act(() => render(<Tab/>, root));
        for (let index = 0; index < 5; index++) await act(tick);

        expect(sendMessage).toHaveBeenCalledTimes(1);
    });
});

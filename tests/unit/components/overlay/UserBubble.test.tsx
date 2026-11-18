import {render, act} from "@/tests/helpers";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {BubbleHost} from "@/components/overlay/UserBubble";
import {useUiStore} from "@/stores/ui";

import {blockEntry, setBlockLists} from "../../../helpers";

// Base UI, lucide는 변환되지 않아 진짜 React를 불러 그려지지 않으므로 버블, 버튼, 아이콘을 평범한 요소로 바꾼다.

vi.mock("lucide-react", () => ({Ban: () => null, ExternalLink: () => null, NotebookPen: () => null, Search: () => null}));

// 다이얼로그는 native <dialog>를 쓰므로 여기서는 그리지 않게 한다.
vi.mock("@/components/dialogs", () => ({
    ModalDialog: () => null,
    DialogActions: () => null,
    DialogDescription: () => null,
    DialogHeader: () => null,
    DialogTitle: () => null,
    firstFocusable: () => null
}));
vi.mock("@/components/overlay/gallogActivity", () => ({useGallogActivity: () => undefined}));
vi.mock("@/core/database", () => ({
    databaseVersion: () => 0,
    subscribeDatabase: () => () => {},
    onDatabaseChange: () => () => {},
    ipInfoOf: () => undefined,
    banReasonsOf: () => undefined
}));

const root = document.createElement("div");
const lines = (): string[] => Array.from(root.querySelectorAll("p ~ div > *"), (row) => row.textContent ?? "");

beforeEach(() => document.body.append(root));
afterEach(() => {
    act(() => render(null, root));
    root.remove();
});

describe("BubbleHost", () => {
    it("허용 목록에 없으면 항목마다가 아니라 유형마다 한 줄로 보이고, 해제할 수 있는 규칙이 먼저 온다", () => {
        const allowList = Array.from({length: 500}, (_, index) => blockEntry(`닉${index}`, {mode: "NOT_SAME"}));
        setBlockLists({NICK: allowList, ID: [blockEntry("stranger")]});
        useUiStore.setState({selected: {nick: "모르는사람", uid: "stranger"}, bubble: {x: 0, y: 0}});

        act(() => render(<BubbleHost onBlockPackage={() => {}} onDcconInfo={() => {}}/>, root));

        expect(lines()).toEqual(["아이디 stranger해제", "닉네임 허용 목록(500개)에 없음"]);
    });
});

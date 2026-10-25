import {render, act} from "@/tests/helpers";
import type {ReactNode} from "react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {BubbleHost} from "@/components/overlay/UserBubble";
import {useUiStore} from "@/stores/ui";

import {blockEntry, setBlockLists} from "../../../helpers";

// Base UI·lucide는 변환되지 않아 진짜 React를 불러 그려지지 않으므로 버블·버튼·아이콘을 평범한 요소로 바꾼다.

vi.mock("lucide-react", () => ({Ban: () => null, ExternalLink: () => null, NotebookPen: () => null, Search: () => null}));

vi.mock("@/components/ui/popover", () => ({
    Popover: ({children}: { children?: ReactNode }) => <>{children}</>,
    PopoverContent: ({children}: { children?: ReactNode }) => <div>{children}</div>
}));
vi.mock("@/components/ui/button", () => ({
    Button: ({children, onClick}: { children?: ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>
}));
vi.mock("@/components/ui/separator", () => ({Separator: () => <hr/>}));
vi.mock("@/components/dialogs", () => ({ModalDialog: () => null, DialogActions: () => null}));
vi.mock("@/components/ui/dialog", () => ({DialogDescription: () => null, DialogHeader: () => null, DialogTitle: () => null}));
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

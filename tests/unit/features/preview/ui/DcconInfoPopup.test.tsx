import {render, act} from "@/tests/helpers";
import type {ReactNode} from "react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {addDcconPackage, fetchDcconPackage} from "@/core/preview/request";
import type {DcinsideDcconPackage} from "@/core/preview/types";
import {clearDcconCaches} from "@/core/preview/dccon";
import {DcconInfoPopup} from "@/features/preview/ui/DcconInfoPopup";
import {usePreviewStore} from "@/features/preview/ui/previewStore";
import {useUiStore} from "@/stores/ui";

import {tick} from "../../../../helpers";

// Base UI는 변환되지 않아 진짜 React를 불러 그려지지 않으므로 창·버튼을 평범한 요소로 바꾼다.
vi.mock("@/components/dialogs", () => ({
    ModalDialog: ({children}: { children?: ReactNode }) => <div>{children}</div>,
    DialogCloseButton: () => null,
    ConfirmDialog: ({confirmLabel, onConfirm}: { confirmLabel?: string; onConfirm: () => void }) => <button onClick={onConfirm}>{confirmLabel}</button>
}));
vi.mock("@/components/ui/button", () => ({
    Button: ({children, disabled, onClick}: { children?: ReactNode; disabled?: boolean; onClick?: () => void }) =>
        <button disabled={disabled} onClick={onClick}>{children}</button>
}));
vi.mock("@/components/ui/badge", () => ({Badge: ({children}: { children?: ReactNode }) => <span>{children}</span>}));
vi.mock("@/components/ui/dialog", () => ({DialogTitle: ({children}: { children?: ReactNode }) => <h2>{children}</h2>}));
vi.mock("@/components/ui/skeleton", () => ({Skeleton: () => null}));
vi.mock("@/components/ui/spinner", () => ({Spinner: () => null}));
vi.mock("@/core/preview/dccon", () => ({clearDcconCaches: vi.fn()}));
vi.mock("@/core/preview/request", () => ({addDcconPackage: vi.fn(), dcconPackages: new Map(), fetchDcconPackage: vi.fn()}));

const pack = (title: string): DcinsideDcconPackage => ({
    info: {package_idx: 9, code: "", title, description: "", seller_name: "판매자", reg_date_short: "", main_img_path: "", register: false, residual: false},
    detail: [],
    tags: []
});
const root = document.createElement("div");
const showToast = vi.fn();
const button = (text: string): HTMLButtonElement | undefined => Array.from(root.querySelectorAll("button")).find((item) => item.textContent === text);

// 패키지 캐시가 모듈에 하나뿐이라 테스트마다 다른 디시콘 코드를 쓴다.
const open = async (code: string): Promise<void> => {
    usePreviewStore.setState({dcconInfo: code});
    await act(() => render(<DcconInfoPopup code={code}/>, root));
};

/** 패키지를 불러온 뒤 '사용' → 확인 창의 '추가'를 누른다. */
const add = async (code: string): Promise<void> => {
    vi.mocked(fetchDcconPackage).mockResolvedValue(pack(code));
    await open(code);
    await vi.waitFor(() => expect(button("사용")).toBeDefined());
    await act(() => button("사용")!.click());
    await act(() => button("추가")!.click());
};

beforeEach(() => useUiStore.setState({showToast}));
afterEach(() => render(null, root));

describe("DcconInfoPopup", () => {
    it("디시콘을 추가하면 알리고 목록 캐시를 비우며 '사용' 버튼을 숨긴다", async () => {
        vi.mocked(addDcconPackage).mockResolvedValue("ok");
        await add("added");
        await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith("디시콘을 추가했습니다."));
        expect(clearDcconCaches).toHaveBeenCalledOnce();
        await vi.waitFor(() => expect(button("사용")).toBeUndefined());
    });

    it("로그인하지 않았으면 경고하고 '사용' 버튼을 남긴다", async () => {
        vi.mocked(addDcconPackage).mockResolvedValue("not_login");
        await add("guest");
        await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith("디시콘은 로그인한 뒤에 추가할 수 있습니다.", "warning"));
        expect(clearDcconCaches).not.toHaveBeenCalled();
        expect(button("사용")).toBeDefined();
    });

    it("불러오기에 실패하면 알리고 창을 닫는다", async () => {
        vi.mocked(fetchDcconPackage).mockRejectedValue(new Error("fail"));
        await open("broken");
        await vi.waitFor(() => expect(showToast).toHaveBeenCalledWith("디시콘 정보를 불러오지 못했습니다.", "error"));
        expect(usePreviewStore.getState().dcconInfo).toBeNull();
    });

    it("닫은 뒤에 실패한 요청은 알리지 않고 다른 창을 닫지 않는다", async () => {
        const {promise, reject} = Promise.withResolvers<DcinsideDcconPackage>();
        vi.mocked(fetchDcconPackage).mockReturnValue(promise);
        await open("closed");
        await act(() => render(null, root));
        usePreviewStore.setState({dcconInfo: "other"});
        reject(new Error("aborted"));
        await tick();
        expect(showToast).not.toHaveBeenCalled();
        expect(usePreviewStore.getState().dcconInfo).toBe("other");
    });
});

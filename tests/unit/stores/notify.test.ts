import {describe, expect, it} from "vitest";

import {BlockedError} from "@/core/http/client";
import {notifyManage} from "@/stores/notify";
import {useUiStore} from "@/stores/ui";

const lastToast = (): {content: string; type: string} => useUiStore.getState().toasts.at(-1)!;

describe("notifyManage", () => {
    it("성공은 완료 문구를, 디시 문구가 있으면 그것을 우선해 실패로 알린다", async () => {
        useUiStore.setState({toasts: []});

        await notifyManage(Promise.resolve({success: true}), "끌올했습니다.", "실패");
        expect([lastToast().content, lastToast().type]).toEqual(["끌올했습니다.", "info"]);

        await notifyManage(Promise.resolve({success: false, message: "권한 없음"}), "성공", "실패");
        expect([lastToast().content, lastToast().type]).toEqual(["권한 없음", "error"]);

        // 문구 없는 실패는 로그인·권한 안내로 띄운다.
        await notifyManage(Promise.resolve({success: false}), "성공", "실패");
        expect(lastToast().content).toContain("로그인과 권한");
        expect(lastToast().type).toBe("error");
    });

    it("요청이 실패하면 failure를 띄우고, 임시 차단은 HTTP 클라이언트가 이미 알렸으니 조용히 둔다", async () => {
        useUiStore.setState({toasts: []});

        expect(await notifyManage(Promise.reject(new Error("네트워크")), "성공", "처리하지 못했습니다.")).toBe(false);
        expect([lastToast().content, lastToast().type]).toEqual(["처리하지 못했습니다.", "error"]);

        const before = useUiStore.getState().toasts.length;
        expect(await notifyManage(Promise.reject(new BlockedError("디시인사이드 임시 차단")), "성공", "처리하지 못했습니다.")).toBe(false);
        expect(useUiStore.getState().toasts.length).toBe(before);
    });
});

import {beforeEach, describe, expect, it} from "vitest";

import {BlockedError} from "@/core/http/client";
import {notifyManage} from "@/stores/notify";
import {useUiStore} from "@/stores/ui";

beforeEach(() => useUiStore.setState({toasts: []}));

const lastToast = () => useUiStore.getState().toasts.at(-1);

describe("notifyManage", () => {
    it("성공하면 디시 문구를, 없으면 done을 알린다", async () => {
        expect(await notifyManage(Promise.resolve({success: true}), "완료", "실패")).toBe(true);
        expect(lastToast()).toMatchObject({content: "완료", type: "info"});

        await notifyManage(Promise.resolve({success: true, message: "디시 문구"}), "완료", "실패");
        expect(lastToast()).toMatchObject({content: "디시 문구", type: "info"});
    });

    it("문구 없는 실패는 로그인·권한을 안내한다", async () => {
        expect(await notifyManage(Promise.resolve({success: false}), "완료", "실패")).toBe(false);
        expect(lastToast()).toMatchObject({content: expect.stringContaining("로그인과 권한"), type: "error"});
    });

    it("요청이 던지면 failure, 임시 차단이면 알리지 않는다", async () => {
        expect(await notifyManage(Promise.reject(new Error("net")), "완료", "실패")).toBe(false);
        expect(lastToast()).toMatchObject({content: "실패", type: "error"});

        useUiStore.setState({toasts: []});
        expect(await notifyManage(Promise.reject(new BlockedError()), "완료", "실패")).toBe(false);
        expect(lastToast()).toBeUndefined();
    });
});

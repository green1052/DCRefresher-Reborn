import {expect, it, vi} from "vitest";

import {notifyListReplaced} from "@/core/list";

const sendMessage = vi.hoisted(() => vi.fn());
vi.mock("@/core/messaging/protocol", () => ({sendMessage}));

it("숨은 탭에선 목록을 몇 번 바꿔도 알리지 않다가 다시 보일 때 한 번만 알린다", () => {
    sendMessage.mockResolvedValue(undefined);
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    notifyListReplaced("test");
    notifyListReplaced("test");
    expect(sendMessage).not.toHaveBeenCalled();

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith("refresher:listReplaced", "test");

    // 보이는 탭은 곧바로 알린다.
    notifyListReplaced("test");
    expect(sendMessage).toHaveBeenCalledTimes(2);
});

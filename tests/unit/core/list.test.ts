import {expect, it, vi} from "vitest";

import {notifyListReplaced} from "@/core/list";
import {LIST_REPLACED_EVENT} from "@/core/messaging/protocol";

const sendMessage = vi.hoisted(() => vi.fn());
vi.mock("@/core/messaging/protocol", async (importOriginal) => ({...await importOriginal<typeof import("@/core/messaging/protocol")>(), sendMessage}));

it("숨은 탭에선 목록을 몇 번 바꿔도 알리지 않다가 다시 보일 때 한 번만 알리고, 다리는 페이지마다 한 번만 건다", async () => {
    sendMessage.mockRejectedValueOnce(new Error("Could not establish connection")).mockResolvedValue(undefined);
    const details: unknown[] = [];
    document.addEventListener(LIST_REPLACED_EVENT, (ev) => details.push(ev instanceof CustomEvent ? ev.detail : undefined));

    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    notifyListReplaced("test");
    notifyListReplaced("test");
    expect(sendMessage).not.toHaveBeenCalled();

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(sendMessage).toHaveBeenCalledExactlyOnceWith("refresher:installListBridge");
    // 다리를 걸지 못했으면 이벤트를 보내지 않고, 다음에 다시 요청한다.
    await new Promise((resolve) => setTimeout(resolve));
    expect(details).toEqual([]);

    notifyListReplaced("a");
    notifyListReplaced("b");
    await vi.waitFor(() => expect(details).toEqual(["a", "b"]));
    expect(sendMessage).toHaveBeenCalledTimes(2);
});

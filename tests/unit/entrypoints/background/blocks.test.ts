import {describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";
import {storage} from "wxt/utils/storage";

import {fillMissingBlockIds} from "@/entrypoints/background/blocks";

describe("fillMissingBlockIds", () => {
    it("id 없는 항목이 든 목록만 id를 붙여 저장하고, 있는 id는 그대로 둔다", async () => {
        await fakeBrowser.storage.local.set({
            "refresher:block:NICK": [{content: "a", isRegex: false}, {id: "b", content: "b", isRegex: false}],
            "refresher:block:ID": [{id: "u", content: "u", isRegex: false}]
        });
        const setItem = vi.spyOn(storage, "setItem");

        await fillMissingBlockIds();

        const {"refresher:block:NICK": nick} = await fakeBrowser.storage.local.get("refresher:block:NICK");
        expect(nick).toEqual([{id: expect.any(String), content: "a", isRegex: false}, {id: "b", content: "b", isRegex: false}]);
        expect(setItem).toHaveBeenCalledOnce();
    });
});

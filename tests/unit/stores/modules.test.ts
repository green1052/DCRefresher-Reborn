import {describe, expect, it} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {initModulesStore} from "@/stores/modules";

describe("initModulesStore", () => {
    it("없어진 모듈의 켜짐 값·설정·캐시와 스키마에 없는 설정을 지운다", async () => {
        await fakeBrowser.storage.local.set({
            "refresher:modules": {gone: true, preview: true},
            "refresher:module:gone:settings": {a: 1},
            "refresher:module:gone:data": {cache: 1},
            "refresher:module:preview:settings": {previewWidth: 900, removedSetting: true},
            "refresher:module:preview:data": {read: ["g:1"]}
        });

        await initModulesStore();

        await expect.poll(async () => Object.keys(await fakeBrowser.storage.local.get(null)).sort()).toEqual([
            "refresher:module:preview:data",
            "refresher:module:preview:settings",
            "refresher:modules"
        ]);
        expect(await fakeBrowser.storage.local.get(null)).toMatchObject({
            "refresher:modules": {preview: true},
            "refresher:module:preview:settings": {previewWidth: 900}
        });
        expect((await fakeBrowser.storage.local.get("refresher:module:preview:settings"))["refresher:module:preview:settings"]).not.toHaveProperty("removedSetting");
    });
});

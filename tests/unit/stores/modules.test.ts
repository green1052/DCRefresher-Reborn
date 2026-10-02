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

        // 정리가 끝날 때까지 기다린다.
        await expect.poll(() => fakeBrowser.storage.local.get(null)).toEqual({
            "refresher:modules": {preview: true},
            "refresher:module:preview:settings": {previewWidth: 900},
            "refresher:module:preview:data": {read: ["g:1"]}
        });
    });
});

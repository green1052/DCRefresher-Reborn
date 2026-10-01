import {describe, expect, it} from "vitest";

import {migrateV5} from "@/core/migrate-v5";

describe("migrateV5", () => {
    it("v5 키가 없으면 그대로 돌려준다", () => {
        const data = {"refresher:modules": {block: true}};
        expect(migrateV5(data)).toBe(data);
    });

    it("모듈 on/off·설정·기본 차단 모드를 v6 키로 옮기고 v5 키·잔재를 버린다", () => {
        const next = migrateV5({
            "refresher:module:컨텐츠 차단:enable": false,
            "refresher:module:미리보기:setting:previewWidth": 900,
            "refresher:module:미리보기:data": {cache: 1},
            "refresher:module:관리:enable": true,
            "refresher:module:관리:setting:checkRatio": true,
            "refresher:module:관리:setting:alarmRatio": 20,
            "refresher:block:NICK:mode": "\"CONTAIN\"",
            "refresher:block:NICK": "[{\"content\":\"a\",\"isRegex\":false}]",
            "refresher:block:TITLE": [],
            "refresher:database:ip": "big",
            "refresher.database.old": 1,
            "__REFRESHER_SETTINGS": {},
            "refresher:memo:UID": {u: {text: "m", color: "#fff"}},
            "refresher:module:preview:settings": {previewWidth: 1000}
        });

        expect(next["refresher:modules"]).toEqual({block: false, manage: true});
        // 이미 있는 v6 값이 이긴다
        expect(next["refresher:module:preview:settings"]).toEqual({previewWidth: 1000});
        // 관리 모듈의 글댓비 설정은 유저 정보로 가고, 관리가 켜져 있었으므로 값이 남는다
        expect(next["refresher:module:userinfo:settings"]).toEqual({checkRatio: true, alarmRatio: 20});
        // :mode가 없는 유형은 v5 기본(SAME)으로 고정한다
        expect(next["refresher:block:defaults"]).toEqual({NICK: "CONTAIN", TITLE: "SAME"});
        expect(next["refresher:block:NICK"]).toEqual([{content: "a", isRegex: false}]);
        expect(next["refresher:memo:UID"]).toEqual({u: {text: "m", color: "#fff"}});
        for (const key of ["refresher:database:ip", "refresher.database.old", "__REFRESHER_SETTINGS", "refresher:module:미리보기:data"]) expect(next).not.toHaveProperty(key);
    });

    it("관리 모듈이 꺼져 있었으면 글댓비·갱차 조회는 꺼진 채 옮긴다", () => {
        const next = migrateV5({"refresher:module:관리:enable": false, "refresher:module:관리:setting:checkRatio": true, "refresher:module:관리:setting:checkPermBan": true});
        expect(next["refresher:module:userinfo:settings"]).toEqual({checkRatio: false, checkPermBan: false});
    });

    it("refresher:modules에 남은 v4 스냅숏은 boolean만 남긴다", () => {
        const next = migrateV5({"refresher:module:관리:enable": true, "refresher:modules": {block: true, old: {name: "x"}}});
        expect(next["refresher:modules"]).toEqual({block: true, manage: true});
    });
});

import {describe, expect, it} from "vitest";

import type {ModuleInfo} from "@/core/module/types";
import {matchSettings} from "@/entrypoints/options/GeneralTab";

const GROUP = {name: "차단 프리셋", desc: "차단 키로 차단할 때 쓰는 값입니다."};

const feature = {
    name: "미리보기",
    description: "글 목록에서 미리보기 창을 띄워 줍니다.",
    settings: {
        listKeyboard: {type: "check", name: "목록 키보드 이동", desc: "J/K로 글을 고릅니다.", default: true},
        blockPresetDay: {type: "check", group: GROUP, name: "기간", desc: "며칠 동안 막습니다.", default: false},
        blockPresetDelete: {type: "check", group: GROUP, name: "글도 삭제", desc: "게시글도 삭제합니다.", default: false}
    }
} satisfies Pick<ModuleInfo, "name" | "description" | "settings">;

const keys = (needle: string) => matchSettings(feature, needle)?.map(([key]) => key);

describe("matchSettings", () => {
    it("검색어가 비거나 모듈 이름·설명에 맞으면 설정을 전부 남긴다", () => {
        const all = ["listKeyboard", "blockPresetDay", "blockPresetDelete"];
        expect(keys("")).toEqual(all);
        expect(keys("미리보기")).toEqual(all);
    });

    it("설정 이름·설명에 맞는 설정만 남긴다 (대소문자 무시)", () => {
        expect(keys("키보드")).toEqual(["listKeyboard"]);
        expect(keys("j/k")).toEqual(["listKeyboard"]);
        expect(keys("삭제")).toEqual(["blockPresetDelete"]);
    });

    it("묶음 이름이 맞으면 그 묶음의 설정을 남긴다", () => {
        expect(keys("프리셋")).toEqual(["blockPresetDay", "blockPresetDelete"]);
    });

    it("맞는 것이 없으면 undefined", () => {
        expect(keys("없는 설정")).toBeUndefined();
    });
});

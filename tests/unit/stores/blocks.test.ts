import {beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {DEFAULT_DETECT_MODE} from "@/core/storage/items";
import {blockKey, composeExtra, initBlocksStore, normalizeBlockList, normalizeDefaults, useBlocksStore} from "@/stores/blocks";

import {setBlockLists, stored} from "../../helpers";

beforeEach(() => setBlockLists());

const entry = (content: string, fields: Partial<{ id: string; gallery: string; isRegex: boolean }> = {}) => ({id: content, content, isRegex: false, ...fields});

describe("normalizeBlockList", () => {
    it("배열이 아니면 빈 목록", () => {
        expect(normalizeBlockList({})).toEqual([]);
        expect(normalizeBlockList(null)).toEqual([]);
    });

    it("모양이 틀리거나 내용이 빈 항목을 뺀다", () => {
        const list = normalizeBlockList([
            {id: "1", content: "ok", isRegex: false},
            {id: "2", content: "  ", isRegex: false},
            {id: "3", content: "x", isRegex: "no"},
            {id: "4", content: "x", isRegex: false, mode: "same"},
            {id: "5", content: "x", isRegex: false, gallery: 1},
            "text"
        ]);
        expect(list.map((item) => item.id)).toEqual(["1"]);
    });

    it("id가 없거나 겹치면 새로 준다", () => {
        const list = normalizeBlockList([{id: "a", content: "1", isRegex: false}, {id: "a", content: "2", isRegex: false}, {content: "3", isRegex: false}]);
        expect(list[0]?.id).toBe("a");
        expect(new Set(list.map((item) => item.id)).size).toBe(3);
    });

    it("플래그와 같은 옛 extra는 버리고 키 순서는 지킨다", () => {
        const [legacy, alias] = normalizeBlockList([
            {id: "1", content: "x", isRegex: true, extra: "[정규식] [갤러리: g]", gallery: "g"},
            {id: "2", content: "y", isRegex: false, extra: "별명"}
        ]);
        expect(legacy?.extra).toBeUndefined();
        expect(Object.keys(legacy ?? {})).toEqual(["id", "content", "isRegex", "extra", "gallery"]);
        expect(alias?.extra).toBe("별명");
    });
});

describe("composeExtra", () => {
    it("정규식·갤러리·모드 순으로 붙인다", () => {
        expect(composeExtra({isRegex: true, gallery: "g", mode: "NOT_SAME"})).toBe("[정규식] [갤러리: g] [불일치]");
        expect(composeExtra({isRegex: false})).toBe("");
    });
});

describe("normalizeDefaults", () => {
    it("모르는 모드는 그 유형의 기본 모드로 둔다", () => {
        expect(normalizeDefaults({NICK: "CONTAIN", TITLE: "same", ID: 1})).toEqual({...DEFAULT_DETECT_MODE, NICK: "CONTAIN"});
        expect(normalizeDefaults("x")).toEqual(DEFAULT_DETECT_MODE);
    });
});

describe("blockKey", () => {
    it("갤러리가 없는 것과 빈 갤러리는 같은 항목이다", () => {
        expect(blockKey({content: "a", isRegex: false})).toBe(blockKey({content: "a", isRegex: true, gallery: ""}));
        expect(blockKey({content: "a", isRegex: false, gallery: "g"})).not.toBe(blockKey({content: "a", isRegex: false}));
    });
});

describe("useBlocksStore", () => {
    const nicks = async () => normalizeBlockList(await stored("refresher:block:NICK"));

    it("addEntries는 같은 content+gallery를 새것으로 바꿔 맨 뒤로 보낸다", async () => {
        await fakeBrowser.storage.local.set({"refresher:block:NICK": [entry("a"), entry("b"), entry("a", {id: "ga", gallery: "g"})]});

        await useBlocksStore.getState().addEntries("NICK", [{content: "a", isRegex: true}, {content: "c", isRegex: false}]);

        const list = await nicks();
        expect(list.map((item) => item.content)).toEqual(["b", "a", "a", "c"]);
        expect(list[2]).toMatchObject({content: "a", isRegex: true});
        expect(list[2]?.id).not.toBe("a");
    });

    it("updateEntry는 내용을 바꾸고 같은 내용의 다른 항목을 지운다", async () => {
        const start = [entry("a"), entry("b")];
        await fakeBrowser.storage.local.set({"refresher:block:NICK": start});
        setBlockLists({NICK: start});

        await useBlocksStore.getState().updateEntry("NICK", "a", {content: "b", isRegex: true});

        expect(await nicks()).toEqual([{id: "a", content: "b", isRegex: true}]);
    });

    it("updateEntry는 스토어에 없는 항목이면 새로 넣는다", async () => {
        await fakeBrowser.storage.local.set({"refresher:block:NICK": [entry("a")]});

        await useBlocksStore.getState().updateEntry("NICK", "gone", {content: "z", isRegex: false});

        expect((await nicks()).map((item) => item.content)).toEqual(["a", "z"]);
    });

    it("updateEntry는 그사이 다른 탭이 지운 항목을 되살리지 않는다", async () => {
        setBlockLists({NICK: [entry("a")]});

        await useBlocksStore.getState().updateEntry("NICK", "a", {content: "b", isRegex: false});

        expect(await stored("refresher:block:NICK")).toEqual([]);
    });

    it("removeEntry는 그 id만 지운다", async () => {
        await fakeBrowser.storage.local.set({"refresher:block:NICK": [entry("a"), entry("b")]});

        await useBlocksStore.getState().removeEntry("NICK", "a");

        expect(await nicks()).toEqual([entry("b")]);
    });

    it("setDefault는 기본 모드를 저장한다", async () => {
        await useBlocksStore.getState().setDefault("NICK", "NOT_SAME");

        expect(useBlocksStore.getState().defaults.NICK).toBe("NOT_SAME");
        expect(await stored("refresher:block:defaults")).toEqual({...DEFAULT_DETECT_MODE, NICK: "NOT_SAME"});
    });

    it("setDefault가 실패하면 저장소 값으로 되돌린다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(fakeBrowser.storage.local, "set").mockRejectedValueOnce(new Error("quota"));

        await expect(useBlocksStore.getState().setDefault("NICK", "NOT_SAME")).rejects.toThrow("quota");

        expect(useBlocksStore.getState().defaults.NICK).toBe("SAME");
    });

    it("initBlocksStore는 목록·기본 모드를 읽고 변경을 따른다", async () => {
        await fakeBrowser.storage.local.set({"refresher:block:ID": [entry("u")], "refresher:block:defaults": {ID: "CONTAIN"}});

        await initBlocksStore();
        expect(useBlocksStore.getState().entries.ID).toEqual([entry("u")]);
        expect(useBlocksStore.getState().defaults.ID).toBe("CONTAIN");

        await fakeBrowser.storage.local.set({"refresher:block:defaults": {ID: "bad"}});
        expect(useBlocksStore.getState().defaults.ID).toBe("SAME");
    });
});

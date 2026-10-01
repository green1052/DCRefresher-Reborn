import {describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {blockKey, composeExtra, initBlocksStore, normalizeBlockList, normalizeDefaults, useBlocksStore} from "@/stores/blocks";

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("normalizeBlockList", () => {
    it("모양이 맞는 항목만 남기고 id가 없거나 겹치면 새로 준다", () => {
        const list = normalizeBlockList([
            {content: "a", isRegex: false},
            {id: "1", content: "b", isRegex: true, mode: "SAME", gallery: "g"},
            {id: "1", content: "c", isRegex: false},
            {content: 1, isRegex: false},
            {content: "d", isRegex: false, mode: "same"},
            "x"
        ]);
        expect(list.map(({content}) => content)).toEqual(["a", "b", "c"]);
        expect(new Set(list.map(({id}) => id)).size).toBe(3);
        expect(list[1]?.id).toBe("1");
        expect(normalizeBlockList("nope")).toEqual([]);
    });

    it("옛 항목의 플래그 문자열 extra는 버린다 (표시할 때 필드로 만든다)", () => {
        const [entry] = normalizeBlockList([{id: "1", content: "a", isRegex: true, gallery: "g", extra: "[정규식] [갤러리: g]"}]);
        expect(entry?.extra).toBeUndefined();
        expect(composeExtra({isRegex: true, gallery: "g", mode: "CONTAIN"})).toBe("[정규식] [갤러리: g] [포함]");
        expect(normalizeBlockList([{id: "1", content: "a", isRegex: false, extra: "별명"}])[0]?.extra).toBe("별명");
    });
});

describe("normalizeDefaults", () => {
    it("모르는 모드는 기본으로 돌린다", () => {
        expect(normalizeDefaults({NICK: "CONTAIN", TITLE: "same", ZZ: "SAME"})).toMatchObject({NICK: "CONTAIN", TITLE: "CONTAIN"});
        expect(normalizeDefaults(null).ID).toBe("SAME");
    });
});

describe("useBlocksStore + 저장소", () => {
    it("저장소를 읽고, 쓰기는 저장소로 가며, 다른 곳의 변경은 watch로 들어온다", async () => {
        await fakeBrowser.storage.local.set({"refresher:block:NICK": [{content: "n", isRegex: false}], "refresher:block:defaults": {NICK: "CONTAIN"}});
        await initBlocksStore();

        const state = useBlocksStore.getState();
        expect(state.entries.NICK.map(({content}) => content)).toEqual(["n"]);
        expect(state.entries.ID).toEqual([]);
        expect(state.defaults).toMatchObject({NICK: "CONTAIN", TITLE: "CONTAIN", ID: "SAME"});

        // 같은 content+gallery는 한 항목이고, 새로 넣은 쪽이 뒤로 간다
        await state.addEntry("NICK", {content: "n", isRegex: false, extra: "별명"});
        await state.addEntry("NICK", {content: "m", isRegex: false});
        const stored = (await fakeBrowser.storage.local.get("refresher:block:NICK"))["refresher:block:NICK"] as { content: string; extra?: string }[];
        expect(stored.map(({content}) => content)).toEqual(["n", "m"]);
        expect(stored[0]?.extra).toBe("별명");
        expect(blockKey({content: "n", isRegex: false})).toBe(blockKey({content: "n", isRegex: true, gallery: undefined}));

        // 이 탭의 쓰기가 watch로 돌아와도 값이 같으면 상태 객체를 바꾸지 않는다
        const listener = vi.fn();
        const unsubscribe = useBlocksStore.subscribe(listener);
        const before = useBlocksStore.getState().entries;
        await fakeBrowser.storage.local.set({"refresher:block:NICK": stored});
        await tick();
        expect(useBlocksStore.getState().entries).toBe(before);

        // 다른 탭(옵션 페이지)의 변경은 들어온다
        await fakeBrowser.storage.local.set({"refresher:block:ID": [{content: "u", isRegex: false}]});
        await tick();
        expect(useBlocksStore.getState().entries.ID.map(({content}) => content)).toEqual(["u"]);
        expect(listener).toHaveBeenCalled();

        await useBlocksStore.getState().setDefault("ID", "NOT_SAME");
        expect((await fakeBrowser.storage.local.get("refresher:block:defaults"))["refresher:block:defaults"]).toMatchObject({ID: "NOT_SAME", NICK: "CONTAIN"});
        unsubscribe();
    });
});

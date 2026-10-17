import {beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import type {MemoEntry} from "@/core/storage/types";
import {findMemo, normalizeMemoMap, ownMemo, useMemosStore} from "@/stores/memos";

const memo = (text: string, gallery?: string): MemoEntry => ({text, color: "#000000", ...(gallery ? {gallery} : {})});

beforeEach(() => useMemosStore.setState({memos: {UID: {}, NICK: {}, IP: {}}}));

describe("findMemo", () => {
    it("아이디 메모가 IP·닉네임 메모보다 먼저다", () => {
        useMemosStore.setState({memos: {UID: {u: memo("아이디")}, IP: {"1.2": memo("아이피")}, NICK: {닉: memo("닉네임")}}});
        expect(findMemo({uid: "u", ip: "1.2", nick: "닉"}, "g")?.text).toBe("아이디");
        expect(findMemo({ip: "1.2", nick: "닉"}, "g")?.text).toBe("아이피");
    });

    it("다른 갤러리 전용 아이디 메모는 건너뛰고 IP, 그다음 닉네임으로 간다", () => {
        useMemosStore.setState({memos: {UID: {u: memo("아이디", "other")}, IP: {"1.2": memo("아이피")}, NICK: {닉: memo("닉네임")}}});
        expect(findMemo({uid: "u", ip: "1.2", nick: "닉"}, "g")?.text).toBe("아이피");
        expect(findMemo({uid: "u", nick: "닉"}, "g")?.text).toBe("닉네임");
        expect(findMemo({uid: "u", nick: "닉"}, "other")?.text).toBe("아이디");
    });

    it("닉네임이 constructor·toString이어도 빈 목록이면 메모가 없다", () => {
        for (const nick of ["constructor", "toString"]) {
            expect(ownMemo({}, nick)).toBeUndefined();
            expect(findMemo({uid: nick, ip: nick, nick})).toBeUndefined();
        }
    });
});

describe("setMemo", () => {
    it("새 메모에 추가 시각을 넣고, 고칠 때는 처음 시각을 지킨다", async () => {
        fakeBrowser.reset();
        const {setMemo} = useMemosStore.getState();
        vi.spyOn(Date, "now").mockReturnValue(100);
        await setMemo("UID", "u", memo("처음"));
        vi.spyOn(Date, "now").mockReturnValue(200);
        await setMemo("UID", "u", memo("고침"));
        expect(useMemosStore.getState().memos.UID.u).toEqual({...memo("고침"), added: 100});
        vi.restoreAllMocks();
    });

    it("시각 없는 옛 메모를 고쳐도 시각을 넣지 않는다", async () => {
        fakeBrowser.reset();
        useMemosStore.setState({memos: {UID: {old: memo("옛")}, NICK: {}, IP: {}}});
        await fakeBrowser.storage.local.set({"refresher:memo:UID": {old: memo("옛")}});
        await useMemosStore.getState().setMemo("UID", "old", memo("고침"));
        expect(useMemosStore.getState().memos.UID.old).toEqual(memo("고침"));
    });
});

describe("normalizeMemoMap", () => {
    it("모양이 틀린 항목을 뺀다", () => {
        expect(normalizeMemoMap({
            ok: memo("ok", "g"),
            noColor: {text: "x"},
            badText: {text: 1, color: "#000000"},
            badGallery: {text: "x", color: "#000000", gallery: 1},
            badAdded: {text: "x", color: "#000000", added: "1"},
            text: "x"
        })).toEqual({ok: memo("ok", "g")});
    });

    it("객체가 아니면 빈 목록", () => {
        expect(normalizeMemoMap(null)).toEqual({});
        expect(normalizeMemoMap("x")).toEqual({});
    });
});

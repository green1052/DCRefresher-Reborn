import {beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {markUsed} from "@/core/usage";
import {findMemo, initMemosStore, normalizeMemoMap, ownMemo, randomColor, useMemosStore} from "@/stores/memos";

import {stored} from "../../helpers";

vi.mock("@/core/usage", async (importOriginal) => ({...await importOriginal<typeof import("@/core/usage")>(), markUsed: vi.fn()}));

const memo = (text: string, gallery?: string) => ({text, color: "#000000", ...(gallery ? {gallery} : {})});

beforeEach(() => useMemosStore.setState({memos: {UID: {}, NICK: {}, IP: {}}}));

describe("randomColor", () => {
    it("#rrggbb이고 너무 밝거나 어둡지 않다", () => {
        for (let index = 0; index < 50; index++) {
            const color = randomColor();
            expect(color).toMatch(/^#[0-9a-f]{6}$/);
            const channels = [1, 3, 5].map((at) => Number.parseInt(color.slice(at, at + 2), 16));
            // 명도 50%·채도 60%라 가장 밝은 채널은 0.8, 가장 어두운 채널은 0.2다.
            expect(Math.max(...channels)).toBe(204);
            expect(Math.min(...channels)).toBe(51);
        }
    });
});

describe("normalizeMemoMap", () => {
    it("모양이 맞는 메모만 남긴다", () => {
        expect(normalizeMemoMap({a: memo("ok"), b: {text: 1, color: ""}, c: {text: "", color: "", gallery: 2}, d: "x"})).toEqual({a: memo("ok")});
        expect(normalizeMemoMap([memo("x")])).toEqual({});
    });
});

describe("ownMemo", () => {
    it("프로토타입 값은 메모가 아니다", () => {
        const map = {a: memo("a")};
        expect(ownMemo(map, "a")).toEqual(memo("a"));
        for (const key of ["toString", "constructor", "__proto__", "hasOwnProperty"]) expect(ownMemo(map, key)).toBeUndefined();
    });
});

describe("findMemo", () => {
    it("아이디 > IP > 닉네임 순으로 찾고 쓰였다고 적는다", () => {
        useMemosStore.setState({memos: {UID: {u: memo("uid")}, IP: {"1.2": memo("ip")}, NICK: {n: memo("nick")}}});

        expect(findMemo({uid: "u", ip: "1.2", nick: "n"})?.text).toBe("uid");
        expect(findMemo({uid: "x", ip: "1.2", nick: "n"})?.text).toBe("ip");
        expect(findMemo({nick: "n"})?.text).toBe("nick");
        expect(findMemo({nick: "toString"})).toBeUndefined();
        expect(vi.mocked(markUsed).mock.calls).toEqual([["memo", "UID:u"], ["memo", "IP:1.2"], ["memo", "NICK:n"]]);
    });

    it("다른 갤러리 전용 메모는 건너뛰고 다음 순서를 본다", () => {
        useMemosStore.setState({memos: {UID: {u: memo("uid", "g1")}, IP: {}, NICK: {n: memo("nick")}}});

        expect(findMemo({uid: "u", nick: "n"}, "g2")?.text).toBe("nick");
        expect(findMemo({uid: "u", nick: "n"}, "g1")?.text).toBe("uid");
        expect(findMemo({uid: "u"})).toBeUndefined();
        expect(vi.mocked(markUsed).mock.calls).toEqual([["memo", "NICK:n"], ["memo", "UID:u"]]);
    });
});

describe("useMemosStore", () => {
    it("setMemo·removeMemo는 저장소 값에 붙여 쓴다", async () => {
        await fakeBrowser.storage.local.set({"refresher:memo:NICK": {other: memo("other")}});

        await useMemosStore.getState().setMemo("NICK", "me", memo("mine"));
        expect(await stored("refresher:memo:NICK")).toEqual({other: memo("other"), me: memo("mine")});

        await useMemosStore.getState().removeMemo("NICK", "other");
        expect(await stored("refresher:memo:NICK")).toEqual({me: memo("mine")});
    });

    it("initMemosStore는 저장된 메모를 읽고 변경을 따른다", async () => {
        await fakeBrowser.storage.local.set({"refresher:memo:UID": {u: memo("a"), bad: 1}});

        await initMemosStore();
        expect(useMemosStore.getState().memos.UID).toEqual({u: memo("a")});

        await fakeBrowser.storage.local.set({"refresher:memo:IP": {"1.2": memo("ip")}});
        expect(useMemosStore.getState().memos.IP).toEqual({"1.2": memo("ip")});
    });
});

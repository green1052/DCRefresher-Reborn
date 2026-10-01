import {describe, expect, it} from "vitest";

import {findMemo, normalizeMemoMap, randomColor, useMemosStore} from "@/stores/memos";

describe("normalizeMemoMap", () => {
    it("모양이 맞는 항목만 남긴다", () => {
        expect(normalizeMemoMap({a: {text: "t", color: "#fff"}, b: {text: 1}, c: "x", d: {text: "t", color: "#000", gallery: "g"}})).toEqual({
            a: {text: "t", color: "#fff"},
            d: {text: "t", color: "#000", gallery: "g"}
        });
        expect(normalizeMemoMap([])).toEqual({});
    });
});

describe("findMemo", () => {
    it("아이디 > IP > 닉네임 순으로 찾고 다른 갤러리 전용 메모는 건너뛴다", () => {
        useMemosStore.setState({memos: {
            UID: {u: {text: "uid", color: ""}, constructor: {text: "proto", color: ""}},
            IP: {"1.2": {text: "ip", color: "", gallery: "g"}},
            NICK: {n: {text: "nick", color: ""}}
        }});
        expect(findMemo({uid: "u", ip: "1.2", nick: "n"})?.text).toBe("uid");
        expect(findMemo({ip: "1.2", nick: "n"}, "g")?.text).toBe("ip");
        expect(findMemo({ip: "1.2", nick: "n"}, "other")?.text).toBe("nick");
        expect(findMemo({nick: "toString"})).toBeUndefined();
        expect(findMemo({uid: "constructor"})?.text).toBe("proto");
    });
});

describe("randomColor", () => {
    it("#rrggbb 형식이다", () => {
        for (let i = 0; i < 20; i++) expect(randomColor()).toMatch(/^#[0-9a-f]{6}$/);
    });
});

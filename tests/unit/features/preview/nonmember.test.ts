import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {savedNonmember, saveNonmember} from "@/features/preview/nonmember";

// Node 26에서는 jsdom의 localStorage 대신 Node의 것(파일 경로 없이는 undefined)이 전역에 보여 메모리 저장소로 바꾼다.
beforeEach(() => {
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => void items.set(key, value)
    });
});
afterEach(() => void vi.unstubAllGlobals());

describe("비회원 정보", () => {
    it("디시가 쓰는 localStorage 키로 읽는다", () => {
        expect(savedNonmember()).toEqual({nick: "", pw: ""});
        localStorage.setItem("nonmember_nick", "닉");
        localStorage.setItem("nonmember_pw", "pw");
        expect(savedNonmember()).toEqual({nick: "닉", pw: "pw"});
    });

    it("빈 비밀번호는 지난 값을 지우지 않는다", () => {
        saveNonmember("닉1", "pw1");
        saveNonmember("닉2", "");
        expect(savedNonmember()).toEqual({nick: "닉2", pw: "pw1"});
    });
});

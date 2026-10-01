import {beforeEach, describe, expect, it} from "vitest";

import {blockingEntries, dcconCode, groupDuplicates, isAnyBlocked, isBlocked} from "@/core/block";
import type {BlockEntry} from "@/core/storage/types";

import {setBlockLists} from "../../helpers";

let seq = 0;
const entry = (fields: Partial<BlockEntry> & { content: string }): BlockEntry => ({id: String(++seq), isRegex: false, ...fields});

beforeEach(() => setBlockLists());

describe("isBlocked", () => {
    it("유형의 기본 모드(닉네임 일치, 제목 포함)를 따른다", () => {
        setBlockLists({NICK: [entry({content: "ㅇㅇ"})], TITLE: [entry({content: "광고"})]});
        expect(isBlocked("NICK", "ㅇㅇ")).toBe(true);
        expect(isBlocked("NICK", "ㅇㅇㅇ")).toBe(false);
        expect(isBlocked("TITLE", "이건 광고임")).toBe(true);
        expect(isBlocked("TITLE", "")).toBe(false);
    });

    it("항목의 mode가 기본 모드보다 우선한다", () => {
        setBlockLists({NICK: [entry({content: "ㅇ", mode: "CONTAIN"})]});
        expect(isBlocked("NICK", "ㅇㅇ")).toBe(true);
    });

    it("정규식은 일치 모드에서 전체가 맞아야 한다", () => {
        setBlockLists({NICK: [entry({content: "닉1|닉1a", isRegex: true})]});
        expect(isBlocked("NICK", "닉1a")).toBe(true);
        expect(isBlocked("NICK", "닉1ab")).toBe(false);
        // 잘못된 정규식은 아무것도 막지 않는다.
        setBlockLists({NICK: [entry({content: "(", isRegex: true})]});
        expect(isBlocked("NICK", "(")).toBe(false);
    });

    it("갤러리 한정 항목은 그 갤러리에서만 막는다", () => {
        setBlockLists({ID: [entry({content: "user", gallery: "a"})]});
        expect(isBlocked("ID", "user", "a")).toBe(true);
        expect(isBlocked("ID", "user", "b")).toBe(false);
        expect(isBlocked("ID", "user")).toBe(false);
    });

    it("NOT_* 항목은 한 유형을 허용 목록으로 본다", () => {
        setBlockLists({NICK: [entry({content: "A"}), entry({content: "B"})]}, {NICK: "NOT_SAME"});
        expect(isBlocked("NICK", "A")).toBe(false);
        expect(isBlocked("NICK", "B")).toBe(false);
        expect(isBlocked("NICK", "C")).toBe(true);
        // 걸린 항목은 허용 목록 전부다.
        expect(blockingEntries({NICK: "C"}).map(({entry: {content}}) => content)).toEqual(["A", "B"]);
    });

    it("SAME 항목과 NOT_* 항목이 섞이면 둘 다 본다", () => {
        setBlockLists({NICK: [entry({content: "A", mode: "NOT_SAME"}), entry({content: "X", mode: "SAME"})]});
        expect(isBlocked("NICK", "A")).toBe(false);
        expect(isBlocked("NICK", "X")).toBe(true);
        expect(isBlocked("NICK", "Y")).toBe(true);
    });
});

describe("isAnyBlocked / blockingEntries", () => {
    it("값이 없는 유형은 건너뛴다", () => {
        setBlockLists({IP: [entry({content: "1.2"})], NICK: [entry({content: "n"})]});
        expect(isAnyBlocked({NICK: null, IP: "1.2"})).toBe(true);
        expect(isAnyBlocked({NICK: "", IP: undefined})).toBe(false);
        expect(blockingEntries({NICK: "n", IP: "1.2"}).map(({type}) => type)).toEqual(["NICK", "IP"]);
    });
    it("isBlocked는 걸린 규칙(blockingEntries)이 있을 때만 참이다", () => {
        // 모드·정규식(잘못된 패턴 포함)·갤러리 한정을 섞은 목록에서 두 판정이 늘 같은지 본다.
        const modes = [undefined, "SAME", "CONTAIN", "NOT_SAME", "NOT_CONTAIN"] as const;
        const contents = ["ab", "a", "x", "a.", "("];
        let seed = 1;
        const pick = <T>(items: readonly T[]): T => items[(seed = (seed * 48271) % 2147483647) % items.length]!;

        for (let round = 0; round < 300; round++) {
            const list = Array.from({length: pick([0, 1, 2, 3])}, () => entry({
                content: pick(contents), mode: pick(modes), isRegex: pick([false, true]), gallery: pick([undefined, "g", "h"])
            }));
            setBlockLists({NICK: list}, {NICK: pick(["SAME", "CONTAIN", "NOT_SAME"] as const)});
            for (const value of ["ab", "a", "zz"]) {
                for (const gallery of [undefined, "g"]) {
                    expect(isBlocked("NICK", value, gallery)).toBe(blockingEntries({NICK: value}, gallery).length > 0);
                }
            }
        }
    });
});

describe("dcconCode", () => {
    it("이미지·video·source의 src 또는 data-src에서 no를 읽는다", () => {
        const img = document.createElement("img");
        img.src = "https://dcimg5.dcinside.com/dccon.php?no=abc";
        expect(dcconCode(img)).toBe("abc");

        const wrapper = document.createElement("span");
        wrapper.innerHTML = "<video data-src=\"https://dcimg5.dcinside.com/dccon.php?no=def\"></video>";
        expect(dcconCode(wrapper)).toBe("def");

        expect(dcconCode(document.createElement("span"))).toBeUndefined();
    });
});

describe("groupDuplicates", () => {
    it("공백만 다른 글을 같게 보고 짧은 글과 적게 반복된 글은 건너뛴다", () => {
        const items = ["같은  댓글", "같은 댓글", "같은 댓글", "ㅋㅋ", "ㅋㅋ", "ㅋㅋ", "다른 댓글"];
        const grouped = groupDuplicates(items, (item) => item, {count: 3, minLength: 3});
        expect(grouped.get("같은  댓글")).toBe(3);
        expect(grouped.get("같은 댓글")).toBe(0);
        expect(grouped.has("ㅋㅋ")).toBe(false);
        expect(grouped.has("다른 댓글")).toBe(false);
    });
});

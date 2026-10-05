import {beforeEach, describe, expect, it, vi} from "vitest";

import {blockingEntries, dcconCode, groupDuplicates, isAnyBlocked, isBlocked, isBlockedHidden} from "@/core/block";
import type {BlockEntry} from "@/core/storage/types";
import {markUsed} from "@/core/usage";
import {useBlocksStore} from "@/stores/blocks";

import {setBlockLists} from "../../helpers";

vi.mock("@/core/usage", () => ({markUsed: vi.fn()}));

let nextId = 0;
const entry = (content: string, fields: Partial<BlockEntry> = {}): BlockEntry => ({id: `e${nextId++}`, content, isRegex: false, ...fields});

const usedIds = (): string[] => vi.mocked(markUsed).mock.calls.map(([, id]) => id);

beforeEach(() => setBlockLists());

describe("isBlocked", () => {
    it("유형의 기본 모드를 따른다", () => {
        setBlockLists({NICK: [entry("닉")], TITLE: [entry("광고")]});
        expect(isBlocked("NICK", "닉")).toBe(true);
        // 닉네임 기본은 일치라 포함만으로는 막지 않는다.
        expect(isBlocked("NICK", "닉네임")).toBe(false);
        expect(isBlocked("TITLE", "무료 광고 글")).toBe(true);
    });

    it("바꾼 기본 모드를 따른다", () => {
        setBlockLists({NICK: [entry("닉")]}, {NICK: "CONTAIN"});
        expect(isBlocked("NICK", "닉네임")).toBe(true);
    });

    it("항목의 모드가 기본 모드보다 앞선다", () => {
        setBlockLists({TITLE: [entry("광고", {mode: "SAME"})]});
        expect(isBlocked("TITLE", "무료 광고")).toBe(false);
        expect(isBlocked("TITLE", "광고")).toBe(true);
    });

    it("빈 내용은 막지 않는다", () => {
        setBlockLists({TITLE: [entry("")]});
        expect(isBlocked("TITLE", "")).toBe(false);
    });

    it("갤러리 한정 항목은 그 갤러리에서만 막는다", () => {
        setBlockLists({NICK: [entry("닉", {gallery: "a"})]});
        expect(isBlocked("NICK", "닉", "a")).toBe(true);
        expect(isBlocked("NICK", "닉", "b")).toBe(false);
        expect(isBlocked("NICK", "닉")).toBe(false);
    });

    it("정규식은 포함 모드에서 일부만 맞아도 막는다", () => {
        setBlockLists({TITLE: [entry("^광고\\d+", {isRegex: true})]});
        expect(isBlocked("TITLE", "광고12 입니다")).toBe(true);
        expect(isBlocked("TITLE", "무료 광고12")).toBe(false);
    });

    it("정규식은 일치 모드에서 전체가 맞아야 막는다", () => {
        setBlockLists({NICK: [entry("닉\\d", {isRegex: true})]});
        expect(isBlocked("NICK", "닉1")).toBe(true);
        expect(isBlocked("NICK", "닉1a")).toBe(false);
    });

    it("일치 모드 정규식은 짧은 앞 대안이 먼저 맞아도 긴 대안으로 전체 일치를 찾는다", () => {
        setBlockLists({NICK: [entry("닉1|닉1a", {isRegex: true})]});
        expect(isBlocked("NICK", "닉1a")).toBe(true);
    });

    it("잘못된 정규식은 아무것도 막지 않는다", () => {
        setBlockLists({TITLE: [entry("(", {isRegex: true})]});
        expect(isBlocked("TITLE", "(")).toBe(false);
    });

    it("NOT_* 항목들은 하나의 허용 목록이다", () => {
        setBlockLists({NICK: [entry("가", {mode: "NOT_SAME"}), entry("나", {mode: "NOT_SAME"})]});
        // 항목마다 뒤집었다면 '가'는 '나' 항목에, '나'는 '가' 항목에 막힌다.
        expect(isBlocked("NICK", "가")).toBe(false);
        expect(isBlocked("NICK", "나")).toBe(false);
        expect(isBlocked("NICK", "다")).toBe(true);
    });

    it("NOT_CONTAIN은 하나라도 포함하면 허용한다", () => {
        setBlockLists({TITLE: [entry("공지", {mode: "NOT_CONTAIN"})]});
        expect(isBlocked("TITLE", "오늘의 공지")).toBe(false);
        expect(isBlocked("TITLE", "잡담")).toBe(true);
    });

    it("잘못된 정규식 NOT_* 항목은 허용 목록에 넣지 않는다", () => {
        setBlockLists({NICK: [entry("(", {isRegex: true, mode: "NOT_SAME"})]});
        expect(isBlocked("NICK", "아무나")).toBe(false);
    });

    it("다른 갤러리의 NOT_* 항목은 허용 목록에 넣지 않는다", () => {
        setBlockLists({NICK: [entry("가", {mode: "NOT_SAME", gallery: "a"})]});
        expect(isBlocked("NICK", "나", "b")).toBe(false);
        expect(isBlocked("NICK", "나", "a")).toBe(true);
    });

    it("허용 목록에 맞아도 SAME 항목에 걸리면 막는다", () => {
        setBlockLists({NICK: [entry("가", {mode: "NOT_SAME"}), entry("가")]});
        expect(isBlocked("NICK", "가")).toBe(true);
    });

    it("막은 항목과 허용한 항목을 모두 쓰였다고 적는다", () => {
        const byNick = entry("닉", {mode: "CONTAIN"});
        const byExact = entry("닉네임");
        const unused = entry("다른닉");
        setBlockLists({NICK: [byNick, byExact, unused]});
        expect(isBlocked("NICK", "닉네임")).toBe(true);
        expect(usedIds()).toEqual([byNick.id, byExact.id]);

        vi.mocked(markUsed).mockClear();
        const allow = entry("가", {mode: "NOT_SAME"});
        const miss = entry("나", {mode: "NOT_SAME"});
        setBlockLists({NICK: [allow, miss]});
        expect(isBlocked("NICK", "가")).toBe(false);
        expect(usedIds()).toEqual([allow.id]);
    });
});

describe("isAnyBlocked", () => {
    it("값 중 하나라도 막히면 참이고 빈 값은 건너뛴다", () => {
        setBlockLists({ID: [entry("uid")]});
        expect(isAnyBlocked({NICK: "닉", ID: "uid"})).toBe(true);
        expect(isAnyBlocked({NICK: "닉", ID: null, IP: undefined})).toBe(false);
    });

    it("막힌 유형에서 멈추지 않고 다른 유형 항목도 쓰였다고 적는다", () => {
        const nick = entry("닉");
        const id = entry("uid");
        setBlockLists({NICK: [nick], ID: [id]});
        expect(isAnyBlocked({NICK: "닉", ID: "uid"})).toBe(true);
        expect(usedIds()).toEqual([nick.id, id.id]);
    });
});

describe("blockingEntries", () => {
    it("걸린 항목을 유형과 함께 돌려준다", () => {
        const nick = entry("닉");
        const id = entry("uid");
        setBlockLists({NICK: [nick, entry("딴닉")], ID: [id]});
        expect(blockingEntries({NICK: "닉", ID: "uid", IP: ""})).toEqual([{type: "NICK", entry: nick}, {type: "ID", entry: id}]);
    });

    it("허용 목록에 맞지 않으면 그 NOT_* 항목 전부를, 맞으면 하나도 돌려주지 않는다", () => {
        const a = entry("가", {mode: "NOT_SAME"});
        const b = entry("나", {mode: "NOT_SAME"});
        setBlockLists({NICK: [a, b]});
        expect(blockingEntries({NICK: "다"}).map(({entry}) => entry)).toEqual([a, b]);
        expect(blockingEntries({NICK: "가"})).toEqual([]);
    });

    it("넘긴 목록을 스토어 대신 쓴다", () => {
        const nick = entry("닉");
        const {defaults} = useBlocksStore.getState();
        expect(blockingEntries({NICK: "닉"}, undefined, {entries: {...useBlocksStore.getState().entries, NICK: [nick]}, defaults})).toEqual([{type: "NICK", entry: nick}]);
        expect(blockingEntries({NICK: "닉"})).toEqual([]);
    });

    it("쓰였다고 적지 않는다", () => {
        setBlockLists({NICK: [entry("닉")]});
        blockingEntries({NICK: "닉"});
        expect(markUsed).not.toHaveBeenCalled();
    });
});

describe("dcconCode", () => {
    const element = (html: string): HTMLElement => {
        const wrap = document.createElement("div");
        wrap.innerHTML = html;
        return wrap.querySelector<HTMLElement>(":scope > *")!;
    };

    it("이미지 src의 no를 읽는다", () => {
        expect(dcconCode(element("<img src='https://dcimg5.dcinside.com/dccon.php?no=abc'>"))).toBe("abc");
    });

    it("src가 없거나 비었으면 data-src를 읽는다", () => {
        expect(dcconCode(element("<video data-src='/dccon.php?no=v1'></video>"))).toBe("v1");
        expect(dcconCode(element("<img src='' data-src='/dccon.php?no=v2'>"))).toBe("v2");
    });

    it("src가 없는 요소는 안의 img·source를 본다", () => {
        expect(dcconCode(element("<span><img src='/dccon.php?no=i1'></span>"))).toBe("i1");
        expect(dcconCode(element("<video><source src='/dccon.php?no=s1'></video>"))).toBe("s1");
    });

    it("no가 없으면 undefined다", () => {
        expect(dcconCode(element("<img src='/dccon.php?x=1'>"))).toBeUndefined();
        expect(dcconCode(element("<span></span>"))).toBeUndefined();
    });
});

describe("isBlockedHidden", () => {
    const target = (html: string): Element => {
        document.body.innerHTML = html;
        return document.querySelector("#t")!;
    };

    it("차단 표시 안이면 가려진 것이다", () => {
        expect(isBlockedHidden(target("<div data-blocked='hide'><img id='t'></div>"))).toBe(true);
        expect(isBlockedHidden(target("<div><img id='t'></div>"))).toBe(false);
    });

    it("가린 내용 보기 중이면 가려지지 않은 것이다", () => {
        expect(isBlockedHidden(target("<div data-block-revealed><div data-blocked='hide'><img id='t'></div></div>"))).toBe(false);
    });

    it("흐림 풀기는 흐림 차단만 밝힌다", () => {
        expect(isBlockedHidden(target("<div data-blur-reveal><div data-blocked='blur'><img id='t'></div></div>"))).toBe(false);
        expect(isBlockedHidden(target("<div data-blur-reveal><div data-blocked='hide'><img id='t'></div></div>"))).toBe(true);
    });
});

describe("groupDuplicates", () => {
    it("공백만 다른 글을 묶고 첫 항목에 반복 수를 적는다", () => {
        const items = ["도배 글", " 도배   글 ", "다른 글", "도배\n글"].map((text) => ({text}));
        const groups = groupDuplicates(items, ({text}) => text, {count: 3, minLength: 2});
        expect([...groups]).toEqual([[items[0], 3], [items[1], 0], [items[3], 0]]);
    });

    it("짧은 글과 적게 반복된 글은 건너뛴다", () => {
        const items = ["ㅋㅋ", "ㅋㅋ", "ㅋㅋ", "두번", "두번"].map((text) => ({text}));
        expect(groupDuplicates(items, ({text}) => text, {count: 3, minLength: 3}).size).toBe(0);
        expect(groupDuplicates(items, ({text}) => text, {count: 3, minLength: 2}).size).toBe(3);
        expect(groupDuplicates(items, ({text}) => text, {count: 2, minLength: 2}).size).toBe(5);
    });
});

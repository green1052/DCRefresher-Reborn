import {webcrypto} from "node:crypto";

import {beforeEach, describe, expect, it, vi} from "vitest";

import {blockingEntries, dcconCode, groupDuplicates, imageHash, isAnyBlocked, isBlocked, isBlockedHidden, isImageBlocked} from "@/core/block";
import {DETECT_MODES} from "@/core/storage/items";
import type {BlockEntry} from "@/core/storage/types";
import {markUsed} from "@/core/usage";
import {useBlocksStore} from "@/stores/blocks";
import {sha256} from "@/utils/hash";
import {imageFingerprints} from "@/utils/imageFingerprint";

import {setBlockLists} from "../../helpers";

vi.mock("@/core/usage", () => ({markUsed: vi.fn()}));
// jsdom은 이미지를 디코딩하지 못해 지문은 테스트가 정한다.
vi.mock("@/utils/imageFingerprint", async (original) => ({...await original<typeof import("@/utils/imageFingerprint")>(), imageFingerprints: vi.fn()}));

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
        // 색인에서 찾는 일치 항목이 먼저 적히므로 순서는 보지 않는다.
        expect(usedIds().toSorted()).toEqual([byNick.id, byExact.id].toSorted());

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

describe("일치 항목 색인", () => {
    it("항목을 하나씩 볼 때와 결과가 같다", () => {
        // 정규식이 아닌 항목을 같은 뜻의 이스케이프한 정규식으로 바꾸면 색인에 들지 않고 하나씩 본다.
        const nicks = [
            entry("가", {mode: "CONTAIN"}), entry("가나"), entry("가", {gallery: "a"}), entry("가"), entry("가나", {mode: "SAME", gallery: "b"}),
            entry("다", {mode: "NOT_SAME"}), entry("라", {mode: "NOT_CONTAIN", gallery: "b"}), entry("마\\d", {isRegex: true}), entry("(", {isRegex: true})
        ];
        const linear = nicks.map((item) => (item.isRegex ? item : {...item, content: RegExp.escape(item.content), isRegex: true}));
        const result = (value: string, gallery?: string): { blocked: boolean; ids: string[] } => ({blocked: isBlocked("NICK", value, gallery), ids: blockingEntries({NICK: value}, gallery).map(({entry}) => entry.id)});

        for (const mode of DETECT_MODES) {
            for (const gallery of [undefined, "a", "b"]) {
                for (const value of ["가", "가나", "가나다", "다", "라라", "마1", "(", "바"]) {
                    // 같은 배열이어도 기본 모드가 바뀌면 색인을 다시 만들어야 한다.
                    setBlockLists({NICK: nicks}, {NICK: mode});
                    const indexed = result(value, gallery);
                    setBlockLists({NICK: linear}, {NICK: mode});
                    expect(indexed).toEqual(result(value, gallery));
                }
            }
        }
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
        expect(isBlockedHidden(target("<div data-comments-revealed><div data-blocked='hide'><img id='t'></div></div>"))).toBe(false);
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

describe("이미지 차단", () => {
    // 해시는 주소별로 모듈에 남으므로 테스트마다 다른 주소를 쓴다.
    let seq = 0;
    const imageUrl = (): string => `https://dcimg8.dcinside.co.kr/viewimage.php?id=x&no=${seq++}`;
    const FINGERPRINT = "0".repeat(32);
    const MIRRORED = "f".repeat(32);
    // dHash·pHash가 각각 4비트 다르다.
    const NEAR = `${"0".repeat(15)}f${"0".repeat(15)}f`;

    const image = (url: string, size = 100): HTMLImageElement => {
        const element = document.createElement("img");
        for (const [key, value] of Object.entries({currentSrc: url, complete: true, naturalWidth: size, naturalHeight: size})) {
            Object.defineProperty(element, key, {value});
        }
        return element;
    };

    let fetchImage: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        // 파일 해시에 WebCrypto(crypto.subtle)가 필요한데 jsdom의 crypto에는 없다.
        vi.stubGlobal("crypto", webcrypto);
        fetchImage = vi.fn(async () => new Response("abc"));
        vi.stubGlobal("fetch", fetchImage);
        vi.mocked(imageFingerprints).mockReset().mockResolvedValue([[FINGERPRINT, MIRRORED]]);
        vi.mocked(markUsed).mockClear();
        vi.spyOn(console, "warn").mockImplementation(() => {});
        return () => vi.unstubAllGlobals();
    });

    describe("imageHash", () => {
        it("주소마다 한 번만 읽고, 지문이 필요해지면 그때 한 번 더 읽는다", async () => {
            const url = imageUrl();
            expect(await imageHash(url)).toEqual({file: await sha256(new TextEncoder().encode("abc")), similar: undefined});
            await imageHash(url);
            expect(fetchImage).toHaveBeenCalledTimes(1);

            expect((await imageHash(url, {similar: true}))?.similar).toEqual([[FINGERPRINT, MIRRORED]]);
            await imageHash(url, {similar: true});
            expect(fetchImage).toHaveBeenCalledTimes(2);
        });

        it("읽지 못한 주소는 retry일 때만 다시 읽는다", async () => {
            const url = imageUrl();
            fetchImage.mockRejectedValueOnce(new TypeError("Failed to fetch"));
            expect(await imageHash(url)).toBeUndefined();
            expect(await imageHash(url)).toBeUndefined();
            expect(fetchImage).toHaveBeenCalledTimes(1);

            expect(await imageHash(url, {retry: true})).toBeDefined();
            expect(fetchImage).toHaveBeenCalledTimes(2);
        });

        it("구간 요청의 206은 mp4 파일 전체를 담았을 때만 받는다", async () => {
            // ftyp(16바이트) + mdat(12바이트)
            const mp4 = Uint8Array.from([0, 0, 0, 16, 102, 116, 121, 112, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 109, 100, 97, 116, 1, 2, 3, 4]);
            fetchImage.mockResolvedValueOnce(new Response(mp4, {status: 206}));
            expect((await imageHash(imageUrl()))?.file).toBe(await sha256(mp4));

            fetchImage.mockResolvedValueOnce(new Response(mp4.subarray(16), {status: 206}));
            expect(await imageHash(imageUrl())).toBeUndefined();
        });

        it("다시 읽다 실패해도 앞서 구한 파일 해시를 지킨다", async () => {
            const url = imageUrl();
            const first = await imageHash(url);
            fetchImage.mockRejectedValue(new TypeError("Failed to fetch"));

            expect(await imageHash(url, {retry: true, similar: true})).toEqual(first);
            expect(await imageHash(url)).toEqual(first);
        });
    });

    describe("isImageBlocked", () => {
        it("같은 파일이면 막는다", async () => {
            const url = imageUrl();
            setBlockLists({IMAGE: [entry((await imageHash(url))!.file)]});
            expect(await isImageBlocked(image(url))).toBe(true);
        });

        it("기준을 주면 지문이 비슷한 이미지와 좌우 반전본도 막는다", async () => {
            setBlockLists({IMAGE: [entry("다른 파일", {similar: NEAR})]});
            expect(await isImageBlocked(image(imageUrl()))).toBe(false);
            expect(await isImageBlocked(image(imageUrl()), undefined, 3)).toBe(false);
            expect(await isImageBlocked(image(imageUrl()), undefined, 4)).toBe(true);

            setBlockLists({IMAGE: [entry("다른 파일", {similar: MIRRORED})]});
            expect(await isImageBlocked(image(imageUrl()), undefined, 4)).toBe(true);
        });

        it("허용 목록(NOT_*) 항목과 다른 갤러리 항목은 지문으로 막지 않는다", async () => {
            setBlockLists({IMAGE: [entry("다른 파일", {similar: FINGERPRINT, gallery: "a"})]});
            expect(await isImageBlocked(image(imageUrl()), "b", 12)).toBe(false);
            expect(await isImageBlocked(image(imageUrl()), "a", 12)).toBe(true);

            const url = imageUrl();
            setBlockLists({IMAGE: [entry((await imageHash(url))!.file, {similar: FINGERPRINT, mode: "NOT_SAME"})]});
            // 같은 파일이라 허용 목록에 맞는다. 지문으로 넓혀 막지 않는다.
            expect(await isImageBlocked(image(url), undefined, 12)).toBe(false);
        });

        it("같은 파일로 막혀도 지문으로 걸린 항목까지 쓰였다고 적는다", async () => {
            const url = imageUrl();
            const exact = entry((await imageHash(url))!.file);
            const near = entry("다른 파일", {similar: NEAR});
            setBlockLists({IMAGE: [exact, near]});

            expect(await isImageBlocked(image(url), undefined, 12)).toBe(true);
            expect(usedIds()).toEqual(expect.arrayContaining([exact.id, near.id]));
        });

        it("움짤 항목은 정지 이미지라면 한 장면만, 움짤이라면 하나 빼고 모든 장면이 맞아야 막는다", async () => {
            const scene = (n: number): string => n.toString(16).repeat(32);
            setBlockLists({IMAGE: [entry("움짤", {similar: scene(1), frames: [scene(2), scene(3), scene(4)]})]});

            // 정지 이미지: 한 장면만 같아도 막는다.
            vi.mocked(imageFingerprints).mockResolvedValue([[scene(3), scene(9)]]);
            expect(await isImageBlocked(image(imageUrl()), undefined, 4)).toBe(true);

            // 움짤: 네 장면 중 셋이 같으면 막고(순서는 보지 않는다), 둘이면 막지 않는다.
            vi.mocked(imageFingerprints).mockResolvedValue([[scene(4), scene(9)], [scene(9), scene(1)], [scene(2), scene(9)], [scene(9), scene(9)]]);
            expect(await isImageBlocked(image(imageUrl()), undefined, 4)).toBe(true);
            vi.mocked(imageFingerprints).mockResolvedValue([[scene(1), scene(9)], [scene(2), scene(9)], [scene(9), scene(9)], [scene(9), scene(9)]]);
            expect(await isImageBlocked(image(imageUrl()), undefined, 4)).toBe(false);
        });

        it("지문 있는 항목이 없거나 너무 큰 이미지면 디코딩하지 않는다", async () => {
            setBlockLists({IMAGE: [entry("다른 파일")]});
            await isImageBlocked(image(imageUrl()), undefined, 12);

            setBlockLists({IMAGE: [entry("다른 파일", {similar: FINGERPRINT})]});
            expect(await isImageBlocked(image(imageUrl(), 10_000), undefined, 12)).toBe(false);
            expect(imageFingerprints).not.toHaveBeenCalled();
        });
    });
});

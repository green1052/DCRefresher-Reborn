import {describe, expect, it, vi} from "vitest";

import {getEntry, postKey, restoreArchive, setEntry} from "@/core/preview/cache";
import type {DcinsideComment} from "@/core/preview/types";

import {preData} from "../../../helpers";

const comment = (no: number, fields: Partial<DcinsideComment> = {}): DcinsideComment => ({
    no: String(no), c_no: "0", depth: 0, user_id: "", name: "ㅇㅇ", ip: "", memo: `댓글 ${no}`, is_delete: "0", date_time: "", ...fields
});

// 캐시는 모듈 전역이라 테스트마다 다른 글을 쓴다.
let seq = 0;
const nextPost = () => preData({id: String(++seq), link: `https://gall.dcinside.com/board/view/?id=test&no=${seq}`});

const nos = (list: DcinsideComment[]) => list.map((item) => `${item.no}${item.is_delete === "1" ? "x" : ""}`);

describe("postKey", () => {
    it("일반 갤러리는 종류를 붙이지 않는다", () => {
        expect(postKey({gallery: "a", id: "1", link: "https://gall.dcinside.com/board/view/?id=a&no=1"})).toBe("a:1");
    });

    it("갤러리 종류가 다르면 키도 다르다", () => {
        const key = (path: string) => postKey({gallery: "a", id: "1", link: `https://gall.dcinside.com/${path}board/view/?id=a&no=1`});
        expect([key("mgallery/"), key("mini/"), key("person/")]).toEqual(["minor/a:1", "mini/a:1", "person/a:1"]);
    });
});

describe("setEntry", () => {
    it("준 필드만 덮어쓴다", () => {
        const pre = nextPost();
        setEntry(pre, {fetchedAt: 1, commentsAt: 2});
        setEntry(pre, {commentsAt: 3});
        expect(getEntry(pre)).toEqual({fetchedAt: 1, commentsAt: 3});
    });

    it("1분이 지나면 사라진다", () => {
        vi.useFakeTimers();
        const pre = nextPost();
        setEntry(pre, {fetchedAt: 1});
        vi.advanceTimersByTime(59_000);
        expect(getEntry(pre)).toBeDefined();
        vi.advanceTimersByTime(1_000);
        expect(getEntry(pre)).toBeUndefined();
    });
});

describe("restoreArchive", () => {
    it("빠진 댓글을 삭제로 되살려 번호순에 넣는다", () => {
        const pre = nextPost();
        restoreArchive(pre, [comment(1), comment(2), comment(3)]);
        const output = restoreArchive(pre, [comment(1), comment(3), comment(4)]);
        expect(nos(output)).toEqual(["1", "2x", "3", "4"]);
        expect(output[1]?.memo).toBe("댓글 2");
    });

    it("되살린 댓글은 다음에도 보인다", () => {
        const pre = nextPost();
        restoreArchive(pre, [comment(1), comment(2)]);
        restoreArchive(pre, [comment(2)]);
        expect(nos(restoreArchive(pre, [comment(2)]))).toEqual(["1x", "2"]);
    });

    it("서버가 삭제로 바꾼 부모 댓글은 원문을 보인다", () => {
        const pre = nextPost();
        restoreArchive(pre, [comment(1, {memo: "원문"})]);
        const changed = comment(1, {memo: "삭제된 댓글입니다.", is_delete: "1"});
        expect(restoreArchive(pre, [changed])).toEqual([comment(1, {memo: "원문", is_delete: "1"})]);
        // 원문을 바뀐 내용으로 덮지 않는다.
        expect(restoreArchive(pre, [changed])[0]?.memo).toBe("원문");
    });

    it("처음부터 삭제로 받은 댓글은 그대로다", () => {
        const pre = nextPost();
        const deleted = comment(1, {memo: "삭제됨", is_delete: "1"});
        expect(restoreArchive(pre, [deleted])).toEqual([deleted]);
    });

    it("잘린 목록은 가장 오래된 스레드 이전을 지우지 않는다", () => {
        const pre = nextPost();
        restoreArchive(pre, [comment(1), comment(2, {c_no: "1", depth: 1}), comment(5), comment(6, {c_no: "5", depth: 1}), comment(8), comment(9)]);
        // 받은 것 중 가장 오래된 스레드는 6의 스레드(5)다. 1·2·5는 범위 밖으로 밀렸을 수 있고 8만 지워졌다.
        expect(nos(restoreArchive(pre, [comment(6, {c_no: "5", depth: 1}), comment(9)], true))).toEqual(["6", "8x", "9"]);
    });

    it("잘리지 않은 목록은 빠진 댓글을 모두 지운다", () => {
        const pre = nextPost();
        restoreArchive(pre, [comment(1), comment(5), comment(6, {c_no: "5", depth: 1}), comment(8)]);
        expect(nos(restoreArchive(pre, [comment(6, {c_no: "5", depth: 1})]))).toEqual(["1x", "5x", "6", "8x"]);
    });

    it("잘렸어도 빈 목록이면 모두 되살린다", () => {
        const pre = nextPost();
        restoreArchive(pre, [comment(1), comment(2)]);
        expect(nos(restoreArchive(pre, [], true))).toEqual(["1x", "2x"]);
    });

    it("글마다 따로 모은다", () => {
        const pre = nextPost();
        restoreArchive(pre, [comment(1)]);
        expect(restoreArchive(nextPost(), [])).toEqual([]);
    });
});

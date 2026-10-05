import {beforeEach, describe, expect, it} from "vitest";

import {getEntry} from "@/core/preview/cache";
import {prepareComments, type ProcessedComment, processComments} from "@/core/preview/comments";
import type {DcinsideComment} from "@/core/preview/types";
import type {BlockEntry} from "@/core/storage/types";
import {type BlockView, useUiStore} from "@/stores/ui";

import {preData, setBlockLists} from "../../../helpers";

const comment = (no: number, fields: Partial<DcinsideComment> = {}): DcinsideComment => ({
    no: String(no), c_no: "0", depth: 0, user_id: "", name: "ㅇㅇ", ip: "", memo: `댓글 ${no}`, is_delete: "0", date_time: "", ...fields
});

let seq = 0;
const nextPost = () => preData({id: String(++seq)});

const entry = (content: string, fields: Partial<BlockEntry> = {}): BlockEntry => ({id: content, content, isRegex: false, ...fields});

const view = (fields: Partial<BlockView> = {}): BlockView => ({blur: false, blurReveal: false, replyRemove: false, revealed: false, duplicate: null, ...fields});

const blocked = (list: ProcessedComment[]) => Object.fromEntries(list.map((item) => [item.no, item.blocked ?? null]));

const DCCON = (no: string) => `img class="written_dccon" src="https://dcimg5.dcinside.com/dccon.php?no=${no}"`;
// 디시가 두 태그를 `><` 없이 붙여 보내는 모양.
const DOUBLE_DCCON = `<${DCCON("aa")}${DCCON("bb")}>`;

beforeEach(() => {
    useUiStore.setState({blockView: null});
    setBlockLists();
});

describe("prepareComments", () => {
    it("댓글돌이를 빼고 삭제 표시를 0/1로 맞춘다", () => {
        const output = prepareComments([
            comment(1),
            comment(2, {nicktype: "COMMENT_BOY"}),
            comment(3, {is_delete: "2"}),
            comment(4, {del_yn: "Y"}),
            comment(5, {del_yn: "N"})
        ], nextPost(), false);
        expect(output.map((item) => [item.no, item.is_delete])).toEqual([["1", "0"], ["3", "1"], ["4", "1"], ["5", "0"]]);
    });

    it("보존을 켜면 빠진 댓글을 되살린다", () => {
        const pre = nextPost();
        prepareComments([comment(1), comment(2)], pre, true);
        expect(prepareComments([comment(2)], pre, true).map((item) => [item.no, item.is_delete])).toEqual([["1", "1"], ["2", "0"]]);
    });

    it("보존을 끄면 되살리지 않는다", () => {
        const pre = nextPost();
        prepareComments([comment(1), comment(2)], pre, false);
        expect(prepareComments([comment(2)], pre, false).map((item) => item.no)).toEqual(["2"]);
    });

    it("댓글돌이는 보존 기록에 남지 않는다", () => {
        const pre = nextPost();
        prepareComments([comment(1), comment(2, {nicktype: "COMMENT_BOY"})], pre, true);
        expect(Object.keys(getEntry(pre)?.seen ?? {})).toEqual(["1"]);
        expect(prepareComments([comment(1)], pre, true).map((item) => item.no)).toEqual(["1"]);
    });

    it("잘린 목록이면 오래된 스레드를 되살리지 않는다", () => {
        const pre = nextPost();
        prepareComments([comment(1), comment(5)], pre, true);
        expect(prepareComments([comment(5)], pre, true, true).map((item) => item.no)).toEqual(["5"]);
    });
});

describe("processComments", () => {
    it("메모를 정화하고 원본은 고치지 않는다", () => {
        const source = [comment(1, {memo: "<b onclick=\"x()\">굵게</b><script>alert(1)</script>"})];
        const [output] = processComments(source, preData());
        expect(output?.memo).toBe("<b>굵게</b>");
        expect(source[0]?.memo).toContain("onclick");
    });

    it("남는 </div> 뒤의 내용도 남긴다", () => {
        const [output] = processComments([comment(1, {memo: "앞</div>뒤"})], preData());
        expect(output?.memo).toContain("뒤");
    });

    it("붙어 온 디시콘 두 개를 두 태그로 나눈다", () => {
        const [output] = processComments([comment(1, {memo: DOUBLE_DCCON})], preData());
        const box = document.createElement("div");
        box.innerHTML = output?.memo ?? "";
        expect(Array.from(box.querySelectorAll("img.written_dccon"), (image) => image.getAttribute("src"))).toEqual([
            "https://dcimg5.dcinside.com/dccon.php?no=aa",
            "https://dcimg5.dcinside.com/dccon.php?no=bb"
        ]);
    });

    it("디시콘 오버 상태를 true로 맞춘다", () => {
        const [output] = processComments([comment(1, {memo: "<img class=\"written_dccon\" data-dcconoverstatus=\"false\">"})], preData());
        expect(output?.memo).toContain("data-dcconoverstatus=\"true\"");
    });

    describe("음성 댓글", () => {
        it("음성 경로를 떼고 글만 남긴다", () => {
            const [output] = processComments([comment(1, {memo: "voice/a.mp3?x=1&y=2@^dc^@들어 봐"})], preData());
            // 정화 전에 떼어 &가 &amp;로 바뀌지 않는다.
            expect(output?.voice).toEqual({src: "https://vr.dcinside.com/voice/a.mp3?x=1&y=2", iframe: false});
            expect(output?.memo).toBe("들어 봐");
        });

        it("음성 iframe은 플레이어 주소를 쓴다", () => {
            const memo = "<iframe src=\"https://vr.dcinside.com/player?no=1&k=2\"></iframe>@^dc^@글";
            const [output] = processComments([comment(1, {memo})], preData());
            expect(output?.voice).toEqual({src: "https://vr.dcinside.com/player?no=1&k=2", iframe: true});
            expect(output?.memo).toBe("글");
        });

        it("다른 호스트 iframe은 버리고 글만 남긴다", () => {
            const [output] = processComments([comment(1, {memo: "<iframe src=\"https://evil.example/\"></iframe>@^dc^@글"})], preData());
            expect(output?.voice).toBeUndefined();
            expect(output?.memo).toBe("글");
        });

        it("디시 응답의 voice: null은 음성 댓글로 보지 않는다 (답글 막힘을 따른다)", () => {
            const raw = {...comment(1, {memo: "글"}), voice: null};
            const [output] = processComments([raw], preData());
            expect(output?.voice).toBeUndefined();
        });
    });

    describe("차단", () => {
        it("차단 모듈이 꺼져 있으면 가리지 않는다", () => {
            setBlockLists({NICK: [entry("나쁜놈")]});
            expect(blocked(processComments([comment(1, {name: "나쁜놈"})], preData()))).toEqual({1: null});
        });

        it("닉·아이디·IP·내용으로 가리고 blur 설정을 따른다", () => {
            setBlockLists({NICK: [entry("닉")], ID: [entry("uid")], IP: [entry("1.2")], COMMENT: [entry("욕")]}, {COMMENT: "CONTAIN"});
            const source = [
                comment(1, {name: "닉"}),
                comment(2, {user_id: "uid"}),
                comment(3, {ip: "1.2"}),
                comment(4, {memo: "<b>이건 욕이다</b>"}),
                comment(5)
            ];
            useUiStore.setState({blockView: view({blur: true})});
            expect(blocked(processComments(source, preData()))).toEqual({1: "blur", 2: "blur", 3: "blur", 4: "blur", 5: null});
            useUiStore.setState({blockView: view({blur: false})});
            expect(processComments(source, preData())[0]?.blocked).toBe("hide");
        });

        it("내용은 공백을 뗀 평문으로 본다", () => {
            setBlockLists({COMMENT: [entry("안녕")]}, {COMMENT: "SAME"});
            useUiStore.setState({blockView: view()});
            expect(processComments([comment(1, {memo: "  <b>안녕</b> "})], preData())[0]?.blocked).toBe("hide");
        });

        it("삭제 표시된 댓글도 검사한다", () => {
            setBlockLists({NICK: [entry("닉")]});
            useUiStore.setState({blockView: view()});
            expect(processComments([comment(1, {name: "닉", is_delete: "1"})], preData())[0]?.blocked).toBe("hide");
        });

        it("두 번째 디시콘이 차단이어도 가린다", () => {
            setBlockLists({DCCON: [entry("bb")]});
            useUiStore.setState({blockView: view()});
            expect(processComments([comment(1, {memo: DOUBLE_DCCON})], preData())[0]?.blocked).toBe("hide");
        });

        it("갤러리 한정 차단은 그 갤러리만 가린다", () => {
            setBlockLists({NICK: [entry("닉", {gallery: "other"})]});
            useUiStore.setState({blockView: view()});
            expect(processComments([comment(1, {name: "닉"})], preData())[0]?.blocked).toBeUndefined();
            expect(processComments([comment(1, {name: "닉"})], preData({gallery: "other"}))[0]?.blocked).toBe("hide");
        });

        it("replyRemove면 답글도 가린다", () => {
            setBlockLists({NICK: [entry("닉")]});
            const source = [comment(1, {name: "닉"}), comment(2, {c_no: "1", depth: 1}), comment(3), comment(4, {c_no: "3", depth: 1})];
            useUiStore.setState({blockView: view({replyRemove: true})});
            expect(blocked(processComments(source, preData()))).toEqual({1: "hide", 2: "hide", 3: null, 4: null});
            useUiStore.setState({blockView: view({replyRemove: false})});
            expect(blocked(processComments(source, preData()))).toEqual({1: "hide", 2: null, 3: null, 4: null});
        });
    });

    describe("같은 댓글 접기", () => {
        it("가린·삭제 댓글을 빼고 묶는다", () => {
            setBlockLists({NICK: [entry("닉")]});
            useUiStore.setState({blockView: view({duplicate: {count: 3, minLength: 2}})});
            const output = processComments([
                comment(1, {memo: "도배 글"}),
                comment(2, {memo: "도배  글"}),
                comment(3, {memo: "도배 글", name: "닉"}),
                comment(4, {memo: "도배 글", is_delete: "1"}),
                comment(5, {memo: "도배 글"}),
                comment(6, {memo: "ㅋ"}),
                comment(7, {memo: "ㅋ"}),
                comment(8, {memo: "ㅋ"})
            ], preData());
            expect(Object.fromEntries(output.map((item) => [item.no, item.duplicates ?? null]))).toEqual({1: 3, 2: 0, 3: null, 4: null, 5: 0, 6: null, 7: null, 8: null});
        });

        it("꺼져 있으면 묶지 않는다", () => {
            useUiStore.setState({blockView: view()});
            const output = processComments([comment(1, {memo: "같은 글"}), comment(2, {memo: "같은 글"})], preData());
            expect(output.every((item) => item.duplicates === undefined)).toBe(true);
        });
    });
});

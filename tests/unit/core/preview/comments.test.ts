import {beforeEach, describe, expect, it} from "vitest";

import {getEntry, restoreArchive} from "@/core/preview/cache";
import {prepareComments, processComments} from "@/core/preview/comments";
import type {DcinsideComment, GalleryPreData} from "@/core/preview/types";
import {useUiStore} from "@/stores/ui";

import {setBlockLists} from "../../../helpers";

let post = 0;
const preDataOf = (): GalleryPreData => ({gallery: "g", id: String(++post), link: "", notice: false, recommend: false, type: "icon_txt", commentCount: 0});

const comment = (no: string, memo: string, extra: Partial<DcinsideComment> = {}): DcinsideComment =>
    ({no, c_no: no, depth: 0, user_id: `u${no}`, name: `n${no}`, ip: "", memo, is_delete: "0", date_time: "", ...extra});

const blockView = {blur: false, blurReveal: true, replyRemove: false, revealed: false, duplicate: null};

beforeEach(() => {
    useUiStore.setState({blockView: null});
    setBlockLists();
});

describe("restoreArchive", () => {
    it("전에 받았다가 이번 목록에서 빠진 댓글을 삭제 표시로 되살린다", () => {
        const preData = preDataOf();
        const first = [comment("1", "a"), comment("2", "b")];
        expect(restoreArchive(preData, first)).toEqual(first);

        const second = restoreArchive(preData, [comment("2", "b"), comment("3", "c")]);
        expect(second.map(({no, is_delete}) => `${no}:${is_delete}`)).toEqual(["1:1", "2:0", "3:0"]);
        expect(second[0]?.memo).toBe("a");
    });

    it("답글이 달려 서버가 내용을 바꾼 부모 댓글은 전에 받은 원문을 삭제 표시로 보인다", () => {
        const preData = preDataOf();
        restoreArchive(preData, [comment("1", "원문")]);
        const next = restoreArchive(preData, [comment("1", "삭제된 댓글입니다", {is_delete: "1"})]);
        expect(next).toEqual([{...comment("1", "원문"), is_delete: "1"}]);
    });

    it("10쪽을 넘어 잘린 목록에서는 가장 오래된 스레드보다 오래된 댓글을 삭제로 치지 않는다", () => {
        const preData = preDataOf();
        restoreArchive(preData, [comment("1", "a"), comment("5", "b")]);
        expect(restoreArchive(preData, [comment("5", "b"), comment("6", "c")], true).map(({no}) => no)).toEqual(["5", "6"]);
        expect(restoreArchive(preData, [comment("5", "b"), comment("6", "c")], false).map(({no}) => no)).toEqual(["1", "5", "6"]);
    });
});

describe("prepareComments", () => {
    it("댓글돌이를 빼고 삭제 코드를 0/1로 맞춘다", () => {
        const preData = preDataOf();
        const list = prepareComments([comment("1", "a", {nicktype: "COMMENT_BOY"}), comment("2", "b", {is_delete: "2"}), comment("3", "c", {del_yn: "Y"})], preData, false);
        expect(list.map(({no, is_delete}) => `${no}:${is_delete}`)).toEqual(["2:1", "3:1"]);
        // 보존이 꺼져 있으면 기록하지 않는다.
        expect(getEntry(preData)?.seen).toBeUndefined();
        prepareComments([comment("4", "d")], preData, true);
        expect(Object.keys(getEntry(preData)?.seen ?? {})).toEqual(["4"]);
    });
});

describe("processComments", () => {
    it("정화하고 음성 댓글을 떼어 낸다. 원본은 고치지 않는다", () => {
        const preData = preDataOf();
        const source = [comment("1", "a<script>x()</script>\n<b onclick=\"y()\">b</b>"), comment("2", "voice/1.mp3@^dc^@글"), comment("3", "<iframe src=\"https://evil.com/\"></iframe>@^dc^@글만")];
        const list = processComments(source, preData);
        expect(list[0]?.memo).toBe("a\n<b>b</b>");
        expect(list[1]).toMatchObject({memo: "글", voice: {src: "https://vr.dcinside.com/voice/1.mp3", iframe: false}});
        expect(list[2]).toMatchObject({memo: "글만", voice: undefined});
        expect(source[0]?.memo).toContain("<script>");
    });

    it("차단 모듈 설정대로 댓글·대댓글을 가리고 같은 댓글을 접는다", () => {
        const preData = preDataOf();
        setBlockLists({NICK: [{id: "x", content: "n1", isRegex: false}], COMMENT: [{id: "y", content: "욕", isRegex: false}]});
        useUiStore.setState({blockView: {...blockView, replyRemove: true, duplicate: {count: 2, minLength: 2}}});

        const source = [
            comment("1", "부모"),
            comment("2", "답글", {c_no: "1", depth: 1}),
            comment("3", "R&amp;B <b>욕</b>설"),
            comment("4", "같은 댓글"),
            comment("5", "같은  댓글"),
            comment("6", "다른")
        ];
        const list = processComments(source, preData);
        expect(list.map(({blocked}) => blocked)).toEqual(["hide", "hide", "hide", undefined, undefined, undefined]);
        expect(list.map(({duplicates}) => duplicates)).toEqual([undefined, undefined, undefined, 2, 0, undefined]);

        useUiStore.setState({blockView: {...blockView, blur: true}});
        expect(processComments(source, preData)[0]?.blocked).toBe("blur");
        // 차단 모듈이 꺼져 있으면 가리지 않는다.
        useUiStore.setState({blockView: null});
        expect(processComments(source, preData).every(({blocked}) => blocked === undefined)).toBe(true);
    });

    it("디시콘 두 개짜리 댓글은 태그를 나눠 둘 다 검사한다", () => {
        const preData = preDataOf();
        setBlockLists({DCCON: [{id: "d", content: "second", isRegex: false}]});
        useUiStore.setState({blockView});
        const memo = "<img class=\"written_dccon\" src=\"https://dcimg5.dcinside.com/dccon.php?no=first\"\"img class=\"written_dccon\" src=\"https://dcimg5.dcinside.com/dccon.php?no=second\">";
        const [processed] = processComments([comment("1", memo)], preData);
        expect(processed?.memo.match(/written_dccon/g)).toHaveLength(2);
        expect(processed?.blocked).toBe("hide");
    });
});

// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {afterEach, beforeEach, expect, it, vi} from "vitest";

import type {CommentListResponse, DcinsideComment, PostInfo} from "@/core/preview/types";
import preview from "@/features/preview/index";
import {usePreviewStore} from "@/features/preview/ui/previewStore";

import {preData as makePreData} from "../../../helpers";
import {type Running, runModule} from "../module";

// 본문은 바로 준다. 댓글은 테스트마다 정한 대로 준다.
const request = vi.hoisted(() => ({fetchComments: vi.fn()}));

vi.mock("@/core/preview/request", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/core/preview/request")>(),
    fetchPost: async (): Promise<PostInfo> => ({contents: "본문", commentCount: 1, commentForm: {fields: [], serviceCode: "", checks: {}}}),
    fetchComments: request.fetchComments
}));

const preData = (id: string) => makePreData({id, link: `https://gall.dcinside.com/board/view/?id=test&no=${id}`});

const comment = (name: string): DcinsideComment => ({no: name, c_no: "0", depth: 0, user_id: "", name, ip: "", memo: `${name} 댓글`, is_delete: "0", date_time: "2026-01-01 00:00:00"});

const names = (): string[] | undefined => usePreviewStore.getState().comments?.map((entry) => entry.name);

let running: Running<unknown> | undefined;

// 기록 남기기(colorPreviewLink)를 끄고 연다: jsdom은 history.go의 이동을 예약 뒤 늦게 popstate로 터뜨리므로 아예 남기지 않는다.
beforeEach(async () => {
    running = await runModule(preview, {colorPreviewLink: false});
});

afterEach(() => {
    running?.stop();
    running = undefined;
    usePreviewStore.setState({viewer: null});
});

it("글을 열면 본문과 댓글을 그린다", async () => {
    request.fetchComments.mockImplementation(async () => ({list: [comment("첫")], allowReply: true}));
    usePreviewStore.getState().requestOpen(preData("1"));
    await vi.waitFor(() => {
        expect(usePreviewStore.getState().post).toBeDefined();
        expect(usePreviewStore.getState().comments).toBeDefined();
    });
    expect(usePreviewStore.getState().post?.contents).toBe("본문");
    expect(names()).toEqual(["첫"]);
});

it("다른 글로 넘어가면 늦게 온 옛 댓글은 그리지 않는다", async () => {
    // 2번 글의 댓글은 받아 두고, 3번 글의 댓글은 바로 준다.
    const late: ((list: CommentListResponse) => void)[] = [];
    request.fetchComments
        .mockImplementationOnce(() => new Promise((resolve) => late.push(resolve)))
        .mockImplementation(async () => ({list: [comment("새")], allowReply: true}));
    usePreviewStore.getState().requestOpen(preData("2"));
    await vi.waitFor(() => expect(usePreviewStore.getState().post).toBeDefined());
    usePreviewStore.getState().requestOpen(preData("3"));
    await vi.waitFor(() => expect(names()).toEqual(["새"]));

    // 2번 글의 댓글이 이제 와도 3번 글 화면을 덮지 않는다.
    late[0]?.({list: [comment("옛")], allowReply: true});
    await new Promise((resolve) => setTimeout(resolve));
    expect(names()).toEqual(["새"]);
});

it("창을 닫으면 상태를 비우고 늦게 온 댓글도 그리지 않는다", async () => {
    const late: ((list: CommentListResponse) => void)[] = [];
    request.fetchComments.mockImplementation(() => new Promise((resolve) => late.push(resolve)));
    usePreviewStore.getState().requestOpen(preData("4"));
    await vi.waitFor(() => expect(usePreviewStore.getState().post).toBeDefined());
    usePreviewStore.getState().requestClose();
    expect(usePreviewStore.getState().visible).toBe(false);
    expect(usePreviewStore.getState().comments).toBeUndefined();

    late[0]?.({list: [comment("늦은")], allowReply: true});
    await new Promise((resolve) => setTimeout(resolve));
    expect(usePreviewStore.getState().comments).toBeUndefined();
});

it("받은 지 10초 안에 다시 열면 댓글을 다시 받지 않는다", async () => {
    request.fetchComments.mockImplementation(async () => ({list: [comment("첫")], allowReply: true}));
    usePreviewStore.getState().requestOpen(preData("5"));
    await vi.waitFor(() => expect(names()).toEqual(["첫"]));
    usePreviewStore.getState().requestClose();
    request.fetchComments.mockClear();

    usePreviewStore.getState().requestOpen(preData("5"));
    await vi.waitFor(() => expect(names()).toEqual(["첫"]));
    expect(request.fetchComments).not.toHaveBeenCalled();
});

it("목록의 댓글 수가 줄었으면 10초 안에 다시 열어도 댓글을 다시 받지 않는다 (줄어듦은 감지 못 함)", async () => {
    request.fetchComments
        .mockImplementationOnce(async () => ({list: [comment("첫"), comment("지워질")], allowReply: true}))
        .mockImplementation(async () => ({list: [comment("첫")], allowReply: true}));
    usePreviewStore.getState().requestOpen({...preData("7"), commentCount: 2});
    await vi.waitFor(() => expect(names()).toEqual(["첫", "지워질"]));
    usePreviewStore.getState().requestClose();

    usePreviewStore.getState().requestOpen({...preData("7"), commentCount: 1});
    await vi.waitFor(() => expect(names()).toEqual(["첫", "지워질"]));
    expect(request.fetchComments).toHaveBeenCalledTimes(1);
});

it("목록의 댓글 수가 늘었으면 10초 안에 다시 열어도 댓글을 다시 받는다", async () => {
    request.fetchComments
        .mockImplementationOnce(async () => ({list: [comment("첫")], allowReply: true}))
        .mockImplementation(async () => ({list: [comment("첫"), comment("새")], allowReply: true}));
    usePreviewStore.getState().requestOpen(preData("6"));
    await vi.waitFor(() => expect(names()).toEqual(["첫"]));
    usePreviewStore.getState().requestClose();

    usePreviewStore.getState().requestOpen({...preData("6"), commentCount: 2});
    await vi.waitFor(() => expect(names()).toEqual(["첫", "새"]));
    expect(request.fetchComments).toHaveBeenCalledTimes(2);
});

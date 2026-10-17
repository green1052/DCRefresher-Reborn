// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {afterEach, beforeEach, expect, it, vi} from "vitest";

import type {CommentListResponse, GalleryPreData, PostInfo} from "@/core/preview/types";
import preview from "@/features/preview/index";
import {usePreviewStore} from "@/features/preview/ui/previewStore";

import {dcComment, preData as makePreData} from "../../../helpers";
import {type Running, runModule} from "../module";

// 본문은 바로 주고, 댓글 요청은 테스트가 reply를 부를 때 응답한다 (끊어도 응답한다: 이미 받은 응답이 늦게 처리되는 경우).
const net = vi.hoisted(() => ({
    comments: [] as { id: string; reply: (nos: string[]) => void }[]
}));

vi.mock("@/core/preview/request", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/core/preview/request")>(),
    fetchPost: async (): Promise<PostInfo> => ({contents: "본문", commentCount: 1, commentForm: {fields: [], serviceCode: "", checks: {}}}),
    fetchComments: (preData: GalleryPreData): Promise<CommentListResponse> =>
        new Promise((resolve) => {
            net.comments.push({id: preData.id, reply: (nos) => resolve({list: nos.map((no) => dcComment(Number(no))), allowReply: true})});
        })
}));

const preData = (id: string) => makePreData({id, link: `/board/view/?id=test&no=${id}`, commentCount: 1});

/** n번째 댓글 요청이 나갈 때까지 기다린다. */
const nthRequest = async (n: number) => {
    await vi.waitFor(() => expect(net.comments).toHaveLength(n));
    return net.comments[n - 1]!;
};

// 그린 댓글 목록을 차례로 모은다. 버려야 할 응답이 잠깐이라도 그려졌는지 본다.
let drawn: string[][] = [];
let running: Running<unknown> | undefined;

beforeEach(async () => {
    running = await runModule(preview);
    running.ctx.addCleanup(usePreviewStore.subscribe((state, previous) => {
        if (state.comments && state.comments !== previous.comments) drawn.push(state.comments.map((c) => c.no));
    }));
});

afterEach(() => {
    running?.stop();
    running = undefined;
    net.comments = [];
    drawn = [];
});

it("다른 글로 넘어간 뒤 도착한 앞 글의 댓글은 그리지 않는다", async () => {
    usePreviewStore.getState().requestOpen(preData("1"));
    const first = await nthRequest(1);
    usePreviewStore.getState().requestOpen(preData("2"));
    const second = await nthRequest(2);
    expect([first.id, second.id]).toEqual(["1", "2"]);

    // 아직 아무것도 그리지 않아 순번으로는 막히지 않는다. 글(signalId)이 달라서 버려야 한다.
    // 앞 글 응답이 먼저 오므로 뒤 글을 그렸을 때는 앞 글 응답도 처리가 끝나 있다.
    first.reply(["11"]);
    second.reply(["21"]);
    await vi.waitFor(() => expect(drawn).toContainEqual(["21"]));
    expect(drawn).toEqual([["21"]]);
});

it("같은 글에서 먼저 보낸 댓글 요청이 늦게 오면 새 목록을 덮지 않는다", async () => {
    usePreviewStore.getState().requestOpen(preData("3"));
    const load = await nthRequest(1);
    const refreshed = usePreviewStore.getState().requestRefresh();
    const refresh = await nthRequest(2);

    refresh.reply(["31", "32"]);
    await refreshed;
    load.reply(["31"]);
    // 늦은 응답보다 나중에 처리되는 새로고침을 하나 더 보내 그때까지 그려진 것을 본다.
    const last = usePreviewStore.getState().requestRefresh();
    (await nthRequest(3)).reply(["31", "32", "33"]);
    await last;
    expect(drawn).toEqual([["31", "32"], ["31", "32", "33"]]);
});

// @vitest-environment-options {"url": "https://gall.dcinside.com/board/lists/?id=test"}
import {afterEach, beforeEach, expect, it, vi} from "vitest";

import type {ManageResult} from "@/core/preview/request";
import type {CommentListResponse, PostInfo} from "@/core/preview/types";
import preview from "@/features/preview/index";
import {usePreviewStore} from "@/features/preview/ui/previewStore";

import {preData as makePreData} from "../../../helpers";
import {type Running, runModule} from "../module";

// 관리 요청은 테스트가 resolve로 끝낸다. 본문·댓글은 바로 준다.
const pending = vi.hoisted(() => ({resolves: [] as ((result: ManageResult) => void)[]}));
const request = vi.hoisted(() => {
    const manage = () => new Promise<ManageResult>((resolve) => pending.resolves.push(resolve));
    return {deletePost: vi.fn(manage), setNotice: vi.fn(manage), blockUser: vi.fn(manage)};
});

vi.mock("@/core/preview/request", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/core/preview/request")>(),
    fetchPost: async (): Promise<PostInfo> => ({contents: "본문", commentCount: 0, commentForm: {fields: [], serviceCode: "", checks: {}}}),
    fetchComments: async (): Promise<CommentListResponse> => ({list: [], allowReply: true}),
    deletePost: request.deletePost,
    setNotice: request.setNotice,
    blockUser: request.blockUser
}));

// 기록에 쌓은 글 정보는 디시 주소일 때만 다시 읽힌다 (core/preview/history.ts의 isGalleryPreData).
const preData = (id: string) => makePreData({id, link: `https://gall.dcinside.com/board/view/?id=test&no=${id}`});

const press = (key: string, target: EventTarget = window): void =>
    void target.dispatchEvent(new KeyboardEvent("keydown", {key, code: `Key${key.toUpperCase()}`, bubbles: true, cancelable: true}));

/** 보낸 관리 요청을 차례로 끝내고 그 뒤 처리가 돌 때까지 기다린다. */
const settle = async (success: boolean): Promise<void> => {
    for (const resolve of pending.resolves.splice(0)) resolve({success});
    await new Promise((resolve) => setTimeout(resolve));
};

let running: Running<unknown> | undefined;

beforeEach(async () => {
    // 관리자 화면이어야 단축키가 듣는다 (isGalleryManager).
    document.body.innerHTML = "<div class=\"useradmin_btnbox\"><button></button></div>";
    running = await runModule(preview, {useKeyPress: true, deleteKey: "d", blockKey: "b", blockPresetDelete: true});
    usePreviewStore.getState().requestOpen(preData("1"));
});

afterEach(() => {
    running?.stop();
    running = undefined;
    pending.resolves = [];
    usePreviewStore.setState({viewer: null});
});

it("삭제 키를 두 번 누르면 한 번만 지우고, 응답을 기다리는 동안 다시 눌러도 더 보내지 않는다", async () => {
    press("d");
    press("d");
    press("d");
    press("d");
    expect(request.deletePost).toHaveBeenCalledTimes(1);
    expect(request.deletePost).toHaveBeenCalledWith(expect.objectContaining({id: "1"}));
    expect(usePreviewStore.getState().visible).toBe(true);

    await settle(true);
    expect(usePreviewStore.getState().visible).toBe(false);
});

it("삭제에 실패하면 창을 닫지 않는다", async () => {
    press("d");
    press("d");
    await settle(false);
    expect(usePreviewStore.getState().visible).toBe(true);
    expect(usePreviewStore.getState().preData?.id).toBe("1");
});

it("앞 글에서 한 번 누른 삭제 키는 다음 글로 이어지지 않는다", () => {
    press("d");
    usePreviewStore.getState().requestOpen(preData("2"));
    press("d");
    expect(request.deletePost).not.toHaveBeenCalled();
});

it("입력칸에 치거나 크게 보기가 떠 있으면 지우지 않는다", () => {
    const input = document.body.appendChild(document.createElement("input"));
    press("d", input);
    press("d", input);
    usePreviewStore.setState({viewer: {images: [], index: 0}});
    press("d");
    press("d");
    expect(request.deletePost).not.toHaveBeenCalled();
});

it("공지 등록이 성공하면 글 정보와 지금 기록을 바꾸고, 그새 다른 글로 넘어갔으면 두 쪽 다 그대로 둔다", async () => {
    usePreviewStore.getState().requestManage("notice");
    expect(request.setNotice).toHaveBeenCalledWith(expect.objectContaining({id: "1"}), true);
    await settle(true);
    expect(usePreviewStore.getState().preData?.notice).toBe(true);
    expect((history.state as { preData?: { notice?: boolean } }).preData?.notice).toBe(true);

    usePreviewStore.getState().requestManage("notice");
    usePreviewStore.getState().requestOpen(preData("2"));
    await settle(true);
    expect(usePreviewStore.getState().preData).toMatchObject({id: "2", notice: false});
});

it("차단 키 두 번은 한 번만 차단하고, 글도 지우는 프리셋이면 같은 글이 열려 있을 때만 닫는다", async () => {
    press("b");
    press("b");
    press("b");
    press("b");
    expect(request.blockUser).toHaveBeenCalledTimes(1);
    await settle(true);
    expect(usePreviewStore.getState().visible).toBe(false);

    usePreviewStore.getState().requestOpen(preData("2"));
    press("b");
    press("b");
    usePreviewStore.getState().requestOpen(preData("3"));
    await settle(true);
    expect(usePreviewStore.getState()).toMatchObject({visible: true, preData: {id: "3"}});
});

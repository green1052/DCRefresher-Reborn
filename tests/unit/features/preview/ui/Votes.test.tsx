import {render, act} from "@/tests/helpers";
import type {ReactNode} from "react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {getEntry, setEntry} from "@/core/preview/cache";
import {vote} from "@/core/preview/request";
import type {PostInfo} from "@/core/preview/types";
import {usePreviewStore} from "@/features/preview/ui/previewStore";
import {Votes} from "@/features/preview/ui/Votes";
import {preData, tick} from "../../../../helpers";

// Base UI·lucide는 변환되지 않아 진짜 React를 불러 그려지지 않으므로 평범한 요소로 바꾼다.
vi.mock("@/components/ui/button", () => ({
    Button: ({children, disabled, onClick, "aria-label": label}: { children?: ReactNode; disabled?: boolean; onClick?: () => void; "aria-label"?: string }) =>
        <button disabled={disabled} onClick={onClick} aria-label={label}>{children}</button>
}));
vi.mock("@/components/ui/spinner", () => ({Spinner: () => null}));
vi.mock("lucide-react", () => ({ChevronDown: () => null, ChevronUp: () => null, ExternalLink: () => null, Link2: () => null}));
vi.mock("@/components/WithTooltip", () => ({TooltipButton: () => null}));
vi.mock("@/core/preview/request", async (importOriginal) => ({...await importOriginal<typeof import("@/core/preview/request")>(), vote: vi.fn()}));

const target = preData({id: "7"});
const post = (fields: Partial<PostInfo> = {}): PostInfo => ({upvotes: "3", fixedUpvotes: "1", downvotes: "2", commentForm: {fields: [], serviceCode: "", checks: {}}, ...fields});
const root = document.createElement("div");

/** 글을 열어 둔 상태로 Votes를 그리고 label로 시작하는 버튼을 누른다. */
const click = async (shown: PostInfo, label: "추천" | "비추천"): Promise<void> => {
    usePreviewStore.setState({preData: target, post: shown});
    await act(() => render(<Votes post={shown}/>, root));
    root.querySelector<HTMLButtonElement>(`button[aria-label^="${label} "]`)!.click();
};

beforeEach(() => setEntry(target, {post: post()}));
afterEach(() => render(null, root));

describe("Votes", () => {
    it("추천하면 추천 수·고정닉 추천 수와 캐시 본문의 숫자를 고친다", async () => {
        vi.mocked(vote).mockResolvedValue({success: true, counts: "4", fixedCounts: "2"});
        await click(post(), "추천");
        await vi.waitFor(() => expect(getEntry(target)?.post?.upvotes).toBe("4"));
        expect(usePreviewStore.getState().post).toMatchObject({upvotes: "4", fixedUpvotes: "2", downvotes: "2"});
        expect(getEntry(target)?.post).toMatchObject({upvotes: "4", fixedUpvotes: "2"});
    });

    it("비추천하면 비추천 수만 고친다", async () => {
        vi.mocked(vote).mockResolvedValue({success: true, counts: "5"});
        await click(post(), "비추천");
        await vi.waitFor(() => expect(getEntry(target)?.post?.downvotes).toBe("5"));
        expect(usePreviewStore.getState().post).toMatchObject({upvotes: "3", fixedUpvotes: "1", downvotes: "5"});
        expect(vi.mocked(vote).mock.calls[0]?.[2]).toBe("D");
    });

    it("응답 전에 다른 글로 넘어갔으면 보이는 글의 숫자는 그대로 둔다", async () => {
        const {promise, resolve} = Promise.withResolvers<{ success: boolean; counts: string }>();
        vi.mocked(vote).mockReturnValue(promise);
        await click(post(), "추천");
        const next = post({upvotes: "10"});
        usePreviewStore.setState((s) => ({signalId: s.signalId + 1, post: next}));
        resolve({success: true, counts: "4"});
        await vi.waitFor(() => expect(getEntry(target)?.post?.upvotes).toBe("4"));
        expect(usePreviewStore.getState().post).toBe(next);
    });

    it("캡차를 받는 글에서 캡차를 취소하면 추천을 보내지 않는다", async () => {
        const openCaptcha = vi.fn(async () => "");
        usePreviewStore.setState({openCaptcha});
        await click(post({requireCaptcha: true}), "추천");
        await vi.waitFor(() => expect(openCaptcha).toHaveBeenCalledOnce());
        await tick();
        expect(vote).not.toHaveBeenCalled();
    });
});

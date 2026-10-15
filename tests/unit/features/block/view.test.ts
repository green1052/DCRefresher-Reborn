// @vitest-environment-options {"url": "https://gall.dcinside.com/board/view/?id=test&no=1"}
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import block from "@/features/block/index";

import {setBlockLists, tick} from "../../../helpers";
import {type Running, runModule} from "../module";

const comment = (text: string): string =>
    `<li class="ub-content"><span class="ub-writer" data-nick="ㅇㅇ" data-uid="" data-ip="1.2"></span><p class="usertxt">${text}</p></li>`;

let running: Running<unknown> | undefined;

beforeEach(() => {
    document.body.innerHTML = "";
    setBlockLists();
});

afterEach(() => {
    running?.stop();
    running = undefined;
});

describe("같은 댓글 접기", () => {
    it("배지를 넣어도 댓글 목록을 다시 접지 않는다", async () => {
        running = await runModule(block, {foldDuplicate: true, duplicateCount: 2, duplicateMinLength: 1});
        const list = Object.assign(document.createElement("ul"), {className: "cmt_list", innerHTML: comment("도배 글") + comment("도배 글")});
        const scans = vi.spyOn(list, "querySelectorAll");
        document.body.append(list);
        // 필터가 접고, 넣은 배지로 목록이 다시 잡히는지 한 차례 더 기다린다.
        await tick();
        await tick();

        expect(list.querySelector(".refresherDuplicateBadge")?.textContent).toBe("같은 댓글 ×2");
        expect(scans.mock.calls.filter(([selector]) => selector === "li.ub-content")).toHaveLength(1);
    });
});

import {expect, it, vi} from "vitest";

import requests from "@/features/requests/index";

import {runModule} from "../module";

const setRequestConcurrency = vi.hoisted(() => vi.fn<(value: number) => void>());
vi.mock("@/core/http/client", () => ({setRequestConcurrency}));

it("동시 요청 수를 걸고, 바꾸면 다시 걸고, 끄면 풀어 둔다", async () => {
    const {change, stop} = await runModule(requests, {concurrency: 2});
    expect(setRequestConcurrency).toHaveBeenLastCalledWith(2);
    change({concurrency: 7});
    expect(setRequestConcurrency).toHaveBeenLastCalledWith(7);
    stop();
    expect(setRequestConcurrency).toHaveBeenLastCalledWith(Number.POSITIVE_INFINITY);
});

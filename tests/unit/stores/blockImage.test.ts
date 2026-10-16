import {webcrypto} from "node:crypto";

import {beforeEach, describe, expect, it, vi} from "vitest";

import {blockImage} from "@/stores/blockRequest";
import {normalizeBlockList} from "@/stores/blocks";

import {setBlockLists, stored} from "../../helpers";

beforeEach(() => {
    setBlockLists();
    // 파일 해시에 WebCrypto(crypto.subtle)가 필요한데 jsdom의 crypto에는 없다.
    vi.stubGlobal("crypto", webcrypto);
    return () => vi.unstubAllGlobals();
});

const list = async (key: string) => normalizeBlockList(await stored(`refresher:block:${key}`));

describe("blockImage", () => {
    const URL_BASE = "https://dcimg8.dcinside.co.kr/viewimage.php?id=x&no=";

    it("이미지 파일의 SHA-256을 일치 항목으로 넣는다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response("abc")));

        await blockImage(`${URL_BASE}1`);

        expect(await list("IMAGE")).toMatchObject([{content: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", isRegex: false}]);
    });

    it("읽지 못하면 넣지 않고, 다시 차단하면 같은 주소를 다시 읽는다", async () => {
        const fetch = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(new Response("abc"));
        vi.stubGlobal("fetch", fetch);
        vi.spyOn(console, "warn").mockImplementation(() => {});

        await blockImage(`${URL_BASE}2`);
        expect(await list("IMAGE")).toEqual([]);

        await blockImage(`${URL_BASE}2`);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(await list("IMAGE")).toHaveLength(1);
    });
});

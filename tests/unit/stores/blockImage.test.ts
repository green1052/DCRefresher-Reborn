import {webcrypto} from "node:crypto";

import {beforeEach, describe, expect, it, vi} from "vitest";

import {isImageBlocked} from "@/core/block";
import {blockImage} from "@/stores/blockRequest";
import {normalizeBlockList} from "@/stores/blocks";
import {sha256} from "@/utils/hash";
import {imageFingerprints} from "@/utils/imageFingerprint";

import {setBlockLists, stored} from "../../helpers";

// jsdom은 이미지를 디코딩하지 못해 지문은 테스트가 정한다.
vi.mock("@/utils/imageFingerprint", () => ({imageFingerprints: vi.fn()}));

beforeEach(() => {
    setBlockLists();
    vi.mocked(imageFingerprints).mockResolvedValue([["a".repeat(32), "b".repeat(32)]]);
    // 파일 해시에 WebCrypto(crypto.subtle)가 필요한데 jsdom의 crypto에는 없다.
    vi.stubGlobal("crypto", webcrypto);
    return () => vi.unstubAllGlobals();
});

const list = async (key: string) => normalizeBlockList(await stored(`refresher:block:${key}`));

describe("blockImage", () => {
    const URL_BASE = "https://dcimg8.dcinside.co.kr/viewimage.php?id=x&no=";

    it("이미지 파일의 SHA-256을 일치 항목으로 넣고, 원본의 지문을 같이 넣는다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response("abc")));

        await blockImage(`${URL_BASE}1`);

        expect(await list("IMAGE")).toMatchObject([{content: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", isRegex: false, similar: "a".repeat(32)}]);
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

    it("움짤은 첫 장면의 지문을 similar에, 나머지를 frames에 넣는다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response("mp4")));
        vi.mocked(imageFingerprints).mockResolvedValue([["1".repeat(32), "a".repeat(32)], ["2".repeat(32), "b".repeat(32)], ["3".repeat(32), "c".repeat(32)]]);

        await blockImage(`${URL_BASE}3`);

        expect(await list("IMAGE")).toMatchObject([{similar: "1".repeat(32), frames: ["2".repeat(32), "3".repeat(32)]}]);
    });

    it("이 페이지에서 본 움짤은 mp4와 원본 gif를 같은 지문으로 함께 넣는다", async () => {
        vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(url)));
        const mp4 = `${URL_BASE}4abcdef01`;
        const gif = `${URL_BASE}4`;
        // mp4를 받다 오류가 나 currentSrc가 빈 움짤도 <source>로 짝을 안다.
        const video = document.createElement("video");
        video.dataset.src = gif;
        video.append(Object.assign(document.createElement("source"), {src: mp4}));
        // 페이지가 <video>를 볼 때 짝을 적어 둔다.
        await isImageBlocked(video);

        await blockImage(gif);

        const stored = await list("IMAGE");
        expect(stored.map((entry) => entry.content)).toEqual([await sha256(new TextEncoder().encode(gif)), await sha256(new TextEncoder().encode(mp4))]);
        expect(stored).toMatchObject([{similar: "a".repeat(32), extra: "움짤"}, {similar: "a".repeat(32), extra: "움짤"}]);
    });
});

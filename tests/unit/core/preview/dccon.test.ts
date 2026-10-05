import {describe, expect, it, vi} from "vitest";

const fetchMock = vi.hoisted(() => (globalThis.fetch = vi.fn<typeof fetch>()));

import {urls} from "@/core/http/urls";
import {addDcconPackage, fetchDcconList, fetchDcconPackage} from "@/core/preview/dccon";
import type {DcinsideDcconDetailList} from "@/core/preview/types";

import {serve} from "./net";

const signal = () => new AbortController().signal;

const pack = (idx: string): DcinsideDcconDetailList => ({detail: [], main_img_url: "", package_idx: idx, title: idx});

describe("fetchDcconPackage", () => {
    it("패키지 정보를 받는다", async () => {
        const response = {info: {package_idx: 1, title: "콘"}, detail: [], tags: []};
        const sent = serve(fetchMock, () => JSON.stringify(response));
        expect(await fetchDcconPackage("code1", signal())).toEqual(response);
        expect(sent[0]?.url).toBe(urls.dccon.detail);
        expect(sent[0]?.body.get("code")).toBe("code1");
    });

    it("error 응답이면 던진다", async () => {
        serve(fetchMock, () => " error\n");
        await expect(fetchDcconPackage("x")).rejects.toThrow("디시콘 정보가 잘못되었습니다.");
    });

    it("모양이 다르면 던진다", async () => {
        serve(fetchMock, () => JSON.stringify({info: {}, detail: [], tags: null}));
        await expect(fetchDcconPackage("x")).rejects.toThrow("디시콘 정보가 아닙니다.");
        serve(fetchMock, () => "null");
        await expect(fetchDcconPackage("x")).rejects.toThrow("디시콘 정보가 아닙니다.");
    });
});

describe("addDcconPackage", () => {
    it("ok·not_login은 그대로, 나머지는 fail이다", async () => {
        const sent = serve(fetchMock, () => "ok\n");
        expect(await addDcconPackage(12)).toBe("ok");
        expect(sent[0]?.url).toBe(urls.dccon.buy);
        expect(sent[0]?.body.get("package_idx")).toBe("12");
        serve(fetchMock, () => "not_login");
        expect(await addDcconPackage("12")).toBe("not_login");
        serve(fetchMock, () => "already");
        expect(await addDcconPackage("12")).toBe("fail");
    });
});

describe("fetchDcconList", () => {
    it("모든 쪽을 이어 붙인다", async () => {
        // max_page는 문자열로 오기도 한다.
        const sent = serve(fetchMock, ({body}) => {
            const page = body.get("page") ?? "";
            return JSON.stringify({target: "icon", max_page: "2", list: [pack(`p${page}`)]});
        });
        const list = await fetchDcconList(signal());
        expect(list).toEqual([pack("p0"), pack("p1"), pack("p2")]);
        expect(sent.map(({body}) => body.get("target"))).toEqual(["icon", "icon", "icon"]);
    });

    it("20쪽까지만 받는다", async () => {
        const sent = serve(fetchMock, () => JSON.stringify({target: "icon", max_page: 50, list: []}));
        await fetchDcconList(signal());
        expect(sent).toHaveLength(20);
    });

    it("비로그인이면 not_login이다", async () => {
        serve(fetchMock, () => "\"not_login\"");
        expect(await fetchDcconList(signal())).toBe("not_login");
        serve(fetchMock, () => "not_login");
        expect(await fetchDcconList(signal())).toBe("not_login");
    });

    it("디시콘이 없으면 shop이다", async () => {
        serve(fetchMock, () => JSON.stringify({target: "shop", max_page: 0}));
        expect(await fetchDcconList(signal())).toBe("shop");
    });

    it("목록이 아니면 던진다", async () => {
        serve(fetchMock, () => JSON.stringify({target: "icon", max_page: 0, list: null}));
        await expect(fetchDcconList(signal())).rejects.toThrow("디시콘 목록이 아닙니다.");
    });

    it("뒤쪽이 not_login이면 그 쪽은 뺀다", async () => {
        serve(fetchMock, ({body}) => (body.get("page") === "1" ? "not_login" : JSON.stringify({target: "icon", max_page: 2, list: [pack(body.get("page") ?? "")]})));
        expect(await fetchDcconList(signal())).toEqual([pack("0"), pack("2")]);
    });
});

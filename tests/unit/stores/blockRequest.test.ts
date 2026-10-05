import {beforeEach, describe, expect, it, vi} from "vitest";
import {fakeBrowser} from "wxt/testing/fake-browser";

import {BlockedError} from "@/core/http/client";
import {fetchDcconPackage} from "@/core/preview/request";
import type {DcinsideDcconPackage} from "@/core/preview/types";
import {handleBlockRequest} from "@/stores/blockRequest";
import {normalizeBlockList} from "@/stores/blocks";
import {useUiStore} from "@/stores/ui";

import {setBlockLists, stored} from "../../helpers";

vi.mock("@/core/preview/request", () => ({fetchDcconPackage: vi.fn()}));

const dcconPackage = (paths: string[]): DcinsideDcconPackage => ({
    info: {package_idx: 7, code: "", title: "팩", description: "", seller_name: "", reg_date_short: "", main_img_path: "", register: false, residual: false},
    detail: paths.map((path, index) => ({idx: String(index), path, title: ""})),
    tags: []
});

const initialUi = useUiStore.getState();
beforeEach(() => {
    setBlockLists();
    useUiStore.setState(initialUi, true);
});

const lastToast = () => useUiStore.getState().toasts.at(-1);
const blockView = {blur: false, blurReveal: false, replyRemove: false, revealed: false, duplicate: null};

describe("유저 차단", () => {
    it("uid > ip > nick 순으로 하나를 넣는다", async () => {
        useUiStore.setState({blockView});
        await handleBlockRequest({target: "user"}, {uid: "u", ip: "1.2", nick: "n"});
        await handleBlockRequest({target: "user"}, {uid: "", ip: "1.2", nick: "n"});
        await handleBlockRequest({target: "user"}, {nick: "n"});

        expect(await stored("refresher:block:ID")).toEqual([expect.objectContaining({content: "u", isRegex: false, extra: "n"})]);
        expect(await stored("refresher:block:IP")).toEqual([expect.objectContaining({content: "1.2", extra: "n"})]);
        expect(await stored("refresher:block:NICK")).toEqual([expect.objectContaining({content: "n", extra: "n"})]);
        expect(lastToast()?.content).toBe("차단 목록에 추가했습니다. (닉네임: n)");
    });

    it("기본 모드가 허용 목록(NOT_*)이면 일치 모드로 넣는다", async () => {
        setBlockLists({}, {ID: "NOT_SAME", IP: "CONTAIN"});
        await handleBlockRequest({target: "user"}, {uid: "u"});
        await handleBlockRequest({target: "user"}, {ip: "1.2"});

        expect(await stored("refresher:block:ID")).toEqual([expect.objectContaining({mode: "SAME"})]);
        expect(await stored("refresher:block:IP")).toEqual([expect.not.objectContaining({mode: expect.anything()})]);
    });

    it("차단 모듈이 꺼져 있으면 가리지 않는다고 알린다", async () => {
        await handleBlockRequest({target: "user"}, {uid: "u"});
        expect(lastToast()?.content).toContain("콘텐츠 차단 모듈이 꺼져 있어");
    });

    it("값이 하나도 없으면 아무것도 하지 않는다", async () => {
        await handleBlockRequest({target: "user"}, {uid: "", nick: ""});
        expect(await fakeBrowser.storage.local.get(null)).toEqual({});
        expect(lastToast()).toBeUndefined();
    });

    it("저장에 실패하면 오류 토스트", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(fakeBrowser.storage.local, "set").mockRejectedValueOnce(new Error("quota"));

        await handleBlockRequest({target: "user"}, {uid: "u"});

        expect(lastToast()).toMatchObject({content: "차단 목록에 저장하지 못했습니다.", type: "error"});
    });
});

describe("디시콘 차단", () => {
    it("하나만 넣을 때는 코드를 넣는다", async () => {
        vi.mocked(fetchDcconPackage).mockResolvedValue(dcconPackage(["p1"]));

        await handleBlockRequest({target: "dccon"}, {dccon: "code"});

        expect(await stored("refresher:block:DCCON")).toEqual([expect.objectContaining({content: "code", isRegex: false, extra: "팩 [7]"})]);
        expect(lastToast()?.content).toBe("디시콘을 차단했습니다. (팩 [7])");
    });

    it("묶음은 경로를 이스케이프한 정규식 하나로 넣는다", async () => {
        vi.mocked(fetchDcconPackage).mockResolvedValue(dcconPackage(["a.b", "c+d"]));

        await handleBlockRequest({target: "dccon", dcconPackage: "bundle"}, {dccon: "code"});

        const [entry] = normalizeBlockList(await stored("refresher:block:DCCON"));
        expect(entry).toMatchObject({isRegex: true, extra: "[묶음] 팩 [7]"});
        const pattern = new RegExp(entry?.content ?? "");
        expect(pattern.test("a.b")).toBe(true);
        expect(pattern.test("axb")).toBe(false);
        expect(pattern.test("c+d")).toBe(true);
        expect(pattern.test("a.bc+d")).toBe(false);
    });

    it("하나씩은 한 번의 쓰기로 디시콘마다 넣는다", async () => {
        vi.mocked(fetchDcconPackage).mockResolvedValue(dcconPackage(["p1", "p2"]));
        const set = vi.spyOn(fakeBrowser.storage.local, "set");

        await handleBlockRequest({target: "dccon", dcconPackage: "each"}, {dccon: "code"});

        expect(set).toHaveBeenCalledTimes(1);
        expect(await stored("refresher:block:DCCON")).toEqual([expect.objectContaining({content: "p1"}), expect.objectContaining({content: "p2"})]);
    });

    it("코드가 없으면 받지 않는다", async () => {
        await handleBlockRequest({target: "dccon"}, {nick: "n"});
        expect(fetchDcconPackage).not.toHaveBeenCalled();
    });

    it("받기에 실패하면 오류 토스트, 임시 차단이면 토스트를 덮지 않는다", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.mocked(fetchDcconPackage).mockRejectedValueOnce(new Error("net"));
        await handleBlockRequest({target: "dccon"}, {dccon: "code"});
        expect(lastToast()).toMatchObject({content: "디시콘을 차단하지 못했습니다.", type: "error"});

        useUiStore.setState({toasts: []});
        vi.mocked(fetchDcconPackage).mockRejectedValueOnce(new BlockedError());
        await handleBlockRequest({target: "dccon"}, {dccon: "code"});
        expect(lastToast()).toBeUndefined();
    });
});

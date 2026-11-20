import {beforeEach, describe, expect, it, vi} from "vitest";

import {getDcconPackage} from "@/core/preview/request";
import type {DcinsideDcconPackage} from "@/core/preview/types";
import {handleBlockRequest} from "@/stores/blockRequest";
import {normalizeBlockList} from "@/core/block-list";

import {setBlockLists, stored} from "../../helpers";

vi.mock("@/core/preview/request", () => ({getDcconPackage: vi.fn()}));

beforeEach(() => setBlockLists());

const list = async (key: string) => normalizeBlockList(await stored(`refresher:block:${key}`));

const dcconPackage = (paths: string[]): DcinsideDcconPackage => ({
    info: {package_idx: 7, code: "c", title: "콘", description: "", seller_name: "", reg_date_short: "", main_img_path: "", register: false, residual: false},
    detail: paths.map((path) => ({idx: path, path, title: path})),
    tags: []
});

describe("handleBlockRequest", () => {
    it("기본 모드가 불일치면 일치로 넣어 허용 목록에 들어가지 않는다", async () => {
        setBlockLists({}, {NICK: "NOT_SAME"});

        await handleBlockRequest({target: "user"}, {nick: "닉"});

        expect(await list("NICK")).toMatchObject([{content: "닉", isRegex: false, mode: "SAME"}]);
    });

    it("기본 모드가 일치면 모드 없이 넣는다", async () => {
        await handleBlockRequest({target: "user"}, {nick: "닉"});

        expect((await list("NICK"))[0]?.mode).toBeUndefined();
    });

    it("uid가 빈 유동은 IP로 넣는다", async () => {
        await handleBlockRequest({target: "user"}, {uid: "", ip: "1.2", nick: "ㅇㅇ"});

        expect(await list("ID")).toEqual([]);
        expect(await list("IP")).toMatchObject([{content: "1.2", extra: "ㅇㅇ"}]);
    });

    it("갤러리를 주면 그 갤러리에서만 막는 항목으로 넣는다", async () => {
        await handleBlockRequest({target: "user", gallery: "gal"}, {uid: "user1", nick: "닉"});
        await handleBlockRequest({target: "user"}, {uid: "user2", nick: "닉"});

        const [scoped, global] = await list("ID");
        expect(scoped).toMatchObject({content: "user1", gallery: "gal"});
        expect(global?.gallery).toBeUndefined();
    });

    it("디시콘 하나는 그 코드를 넣는다", async () => {
        vi.mocked(getDcconPackage).mockResolvedValue(dcconPackage(["a", "b"]));

        await handleBlockRequest({target: "dccon"}, {dccon: "code1"});

        expect(await list("DCCON")).toMatchObject([{content: "code1", isRegex: false, extra: "콘 [7]"}]);
    });

    it("패키지 묶음은 이스케이프한 경로를 정규식 하나로 넣는다", async () => {
        vi.mocked(getDcconPackage).mockResolvedValue(dcconPackage(["a.b", "c+d"]));

        await handleBlockRequest({target: "dccon", dcconPackage: "bundle"}, {dccon: "code1"});

        const [entry] = await list("DCCON");
        expect(entry).toMatchObject({content: `^(?:(?:${RegExp.escape("a.b")}|${RegExp.escape("c+d")}))$`, isRegex: true});
        const pattern = new RegExp(entry?.content ?? "");
        expect(pattern.test("a.b")).toBe(true);
        expect(pattern.test("axb")).toBe(false);
    });

    it("묶음 정규식은 공통 접두사를 한 번만 쓴다", async () => {
        vi.mocked(getDcconPackage).mockResolvedValue(dcconPackage(["pkg1234aa", "pkg1234bb"]));

        await handleBlockRequest({target: "dccon", dcconPackage: "bundle"}, {dccon: "code1"});

        const [entry] = await list("DCCON");
        expect(entry).toMatchObject({content: `^(?:${RegExp.escape("pkg1234")}(?:aa|bb))$`, isRegex: true});
        const pattern = new RegExp(entry?.content ?? "");
        expect(pattern.test("pkg1234aa")).toBe(true);
        expect(pattern.test("pkg1234bb")).toBe(true);
        expect(pattern.test("pkg1234cc")).toBe(false);
    });

    it("순수 16진수 경로는 이스케이프 없이 그대로 저장한다", async () => {
        vi.mocked(getDcconPackage).mockResolvedValue(dcconPackage(["36ab12cd", "36ab12ef"]));

        await handleBlockRequest({target: "dccon", dcconPackage: "bundle"}, {dccon: "code1"});

        const [entry] = await list("DCCON");
        expect(entry).toMatchObject({content: "^(?:36ab12(?:cd|ef))$", isRegex: true});
        const pattern = new RegExp(entry?.content ?? "");
        expect(pattern.test("36ab12cd")).toBe(true);
        expect(pattern.test("36ab12ef")).toBe(true);
        expect(pattern.test("36ab12ff")).toBe(false);
    });

    it("묶음이 하나뿐이면 접두사 없이 그대로 넣는다", async () => {
        vi.mocked(getDcconPackage).mockResolvedValue(dcconPackage(["x"]));

        await handleBlockRequest({target: "dccon", dcconPackage: "bundle"}, {dccon: "code1"});

        const [entry] = await list("DCCON");
        expect(entry).toMatchObject({content: `^(${RegExp.escape("x")})$`, isRegex: true});
    });
});

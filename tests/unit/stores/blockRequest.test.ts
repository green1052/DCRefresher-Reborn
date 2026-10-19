import {beforeEach, describe, expect, it, vi} from "vitest";

import {fetchDcconPackage} from "@/core/preview/request";
import type {DcinsideDcconPackage} from "@/core/preview/types";
import {handleBlockRequest} from "@/stores/blockRequest";
import {normalizeBlockList} from "@/stores/blocks";

import {setBlockLists, stored} from "../../helpers";

vi.mock("@/core/preview/request", () => ({fetchDcconPackage: vi.fn()}));

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
        vi.mocked(fetchDcconPackage).mockResolvedValue(dcconPackage(["a", "b"]));

        await handleBlockRequest({target: "dccon"}, {dccon: "code1"});

        expect(await list("DCCON")).toMatchObject([{content: "code1", isRegex: false, extra: "콘 [7]"}]);
    });

    it("패키지 묶음은 이스케이프한 경로를 정규식 하나로 넣는다", async () => {
        vi.mocked(fetchDcconPackage).mockResolvedValue(dcconPackage(["a.b", "c+d"]));

        await handleBlockRequest({target: "dccon", dcconPackage: "bundle"}, {dccon: "code1"});

        const [entry] = await list("DCCON");
        expect(entry).toMatchObject({content: `^(${RegExp.escape("a.b")}|${RegExp.escape("c+d")})$`, isRegex: true});
        const pattern = new RegExp(entry?.content ?? "");
        expect(pattern.test("a.b")).toBe(true);
        expect(pattern.test("axb")).toBe(false);
    });
});

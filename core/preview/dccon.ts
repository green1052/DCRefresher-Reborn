import QuickLRU from "quick-lru";

import {ajax} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import {csrfBody} from "@/core/http/cookie";
import {isRecord} from "@/utils/record";

import type {DcinsideDcconDetail, DcinsideDcconDetailList, DcinsideDcconPackage} from "./types";

/**
 * 디시콘 관련 캐시의 수명. 창을 닫았다 열어도 다시 받지 않고, 새로 산 디시콘이 보이도록 이 뒤에는 다시 받는다.
 */
const DCCON_TTL = 10 * 60_000;

/**
 * 디시콘 코드별 패키지 정보. 같은 디시콘을 다시 눌러도 받지 않는다. 정보 창과 디시콘 버블이 같이 쓴다.
 */
export const dcconPackages = new QuickLRU<string, DcinsideDcconPackage>({maxSize: 100, maxAge: DCCON_TTL});

/** 내 디시콘 패키지 목록 캐시 (한 슬롯). 디시콘 선택 창이 닫았다 열어도 다시 받지 않게 쓴다. */
let dcconListCache: { list: DcinsideDcconDetailList[]; at: number } | null = null;

export const cachedDcconList = (): DcinsideDcconDetailList[] | null =>
    dcconListCache && Date.now() - dcconListCache.at < DCCON_TTL ? dcconListCache.list : null;

export const setCachedDcconList = (list: DcinsideDcconDetailList[]): void => {
    dcconListCache = {list, at: Date.now()};
};

/**
 * 디시콘 캐시를 비운다. 패키지를 추가하면 가졌는지(residual)가 바뀌므로 목록과 패키지 정보 둘 다 비운다.
 * 같은 패키지의 다른 디시콘도 코드가 달라 따로 담기기 때문이다.
 */
export const clearDcconCaches = (): void => {
    dcconPackages.clear();
    dcconListCache = null;
};

const isDcconPackage = (value: unknown): value is DcinsideDcconPackage =>
    isRecord(value) && isRecord(value.info) && Array.isArray(value.detail) && Array.isArray(value.tags);

/** 디시콘 하나의 코드로 패키지 정보를 가져온다 (디시 dc_common2.js의 '디시콘 보기'). */
export const fetchDcconPackage = async (code: string, signal?: AbortSignal): Promise<DcinsideDcconPackage> => {
    const text = await ajax.post(urls.dccon.detail, {
        body: await csrfBody({code}),
        signal
    }).text();
    // 잘못된 코드면 JSON 대신 'error'가 온다.
    if (text.trim() === "error") throw new Error("디시콘 정보가 잘못되었습니다.");

    const response: unknown = JSON.parse(text);
    // 다른 모양(실패 응답 등)이면 정보 창을 그리다 오버레이 전체가 깨지므로 실패로 넘긴다 (fetchPage와 같다).
    if (!isDcconPackage(response)) throw new Error("디시콘 정보가 아닙니다.");
    return response;
};

/** 캐시에 있으면 캐시, 없으면 받아서 담는다. 버블·정보 창이 이미 받아 둔 패키지를 차단할 때 다시 받지 않는다. */
export const getDcconPackage = async (code: string, signal?: AbortSignal): Promise<DcinsideDcconPackage> => {
    const cached = dcconPackages.get(code);
    if (cached) return cached;

    const response = await fetchDcconPackage(code, signal);
    dcconPackages.set(code, response);
    return response;
};

/** 무료 디시콘 패키지를 내 디시콘에 추가한다 (디시 dc_common2.js의 '사용' 버튼). */
export const addDcconPackage = async (packageIdx: string | number): Promise<"ok" | "fail" | "not_login"> => {
    const text = (await ajax.post(urls.dccon.buy, {body: await csrfBody({package_idx: String(packageIdx)})}).text()).trim();
    return text === "ok" || text === "not_login" ? text : "fail";
};

// 쪽이 이보다 많으면 뒤쪽은 받지 않는다. 한 쪽에 패키지 여러 개라 보통 몇 쪽이다.
const MAX_PAGES = 20;

/** 내 디시콘 패키지 목록. 로그인하지 않았으면 'not_login', 디시콘이 하나도 없으면(상점 안내) 'shop'. */
type DcconListResult = DcinsideDcconDetailList[] | "not_login" | "shop";

const isDcconDetail = (value: unknown): value is DcinsideDcconDetail => isRecord(value) && (value.target === "shop" || Array.isArray(value.list));

/** 한 쪽. 비로그인이면 JSON 대신 'not_login'이 온다 (디시 dccon.js). */
const fetchPage = async (page: number, signal: AbortSignal): Promise<DcinsideDcconDetail | "not_login"> => {
    const body = await csrfBody({target: "icon", page: String(page)});
    const text = await ajax.post(urls.dccon.lists, {body, signal}).text();
    if (/^"?not_login"?$/.test(text.trim())) return "not_login";

    const response: unknown = JSON.parse(text);
    // 다른 모양(실패 응답 등)이면 목록을 그리다 오버레이 전체가 깨지므로 실패로 넘긴다.
    if (!isDcconDetail(response)) throw new Error("디시콘 목록이 아닙니다.");
    return response;
};

/**
 * 모든 쪽(0부터 max_page까지)의 패키지를 이어 붙여, 쪽을 넘기지 않고 가로로 훑어 고르게 한다.
 * 첫 쪽 뒤의 쪽은 한꺼번에 받는다 (동시 요청 수는 요청 제한을 따른다).
 */
export const fetchDcconList = async (signal: AbortSignal): Promise<DcconListResult> => {
    const first = await fetchPage(0, signal);
    if (first === "not_login") return first;
    if (first.target === "shop") return "shop";

    // max_page가 문자열로 오기도 한다 (디시 dccon.js도 ==로 비교한다).
    const last = Math.min(Number(first.max_page) || 0, MAX_PAGES - 1);
    const rest = await Promise.all(Array.from({length: last}, (_, index) => fetchPage(index + 1, signal)));
    return [first, ...rest].flatMap((page) => (page !== "not_login" && Array.isArray(page.list) ? page.list : []));
};

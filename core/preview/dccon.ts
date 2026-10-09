import {ajax} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import {csrfBody} from "@/core/http/cookie";
import {isRecord} from "@/utils/record";

import type {DcinsideDcconDetail, DcinsideDcconDetailList, DcinsideDcconPackage} from "./types";

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

/** 무료 디시콘 패키지를 내 디시콘에 추가한다 (디시 dc_common2.js의 '사용' 버튼). */
export const addDcconPackage = async (packageIdx: string | number): Promise<"ok" | "fail" | "not_login"> => {
    const text = (await ajax.post(urls.dccon.buy, {body: await csrfBody({package_idx: String(packageIdx)})}).text()).trim();
    return text === "ok" || text === "not_login" ? text : "fail";
};

// 쪽이 이보다 많으면 뒤쪽은 받지 않는다. 한 쪽에 패키지 여러 개라 보통 몇 쪽이다.
const MAX_PAGES = 20;

/** 내 디시콘 패키지 목록. 로그인하지 않았으면 'not_login', 디시콘이 하나도 없으면(상점 안내) 'shop'. */
type DcconListResult = DcinsideDcconDetailList[] | "not_login" | "shop";

// 디시콘이 하나도 없으면 목록 대신 상점 안내(target "shop")가 온다.
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
 * 모든 쪽의 패키지를 이어 붙인다. 디시는 쪽마다 따로 주고(0부터 max_page까지) 창 안에서 넘기게 하지만,
 * 한 줄로 이어 두면 넘기지 않고 가로로 훑어 고를 수 있다. 첫 쪽 뒤의 쪽은 한꺼번에 받는다 (동시 요청 수는 요청 제한을 따른다).
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

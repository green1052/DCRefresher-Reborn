import {ajax} from "@/core/http/client";
import {urls} from "@/core/http/urls";
import {csrfBody} from "@/utils/cookie";
import {isRecord} from "@/utils/record";

import type {DcinsideDcconPackage} from "./types";

/** 디시콘 하나의 코드로 패키지 정보를 가져온다 (디시 dc_common2.js의 '디시콘 보기'). */
export const fetchDcconPackage = async (code: string, signal?: AbortSignal): Promise<DcinsideDcconPackage> => {
    const text = await ajax.post(urls.dccon.detail, {
        body: await csrfBody({code}),
        signal
    }).text();
    // 잘못된 코드면 JSON 대신 'error'가 온다.
    if (text.trim() === "error") throw new Error("디시콘 정보가 잘못되었습니다.");

    const response = JSON.parse(text) as DcinsideDcconPackage;
    // 다른 모양(실패 응답 등)이면 정보 창을 그리다 오버레이 전체가 깨지므로 실패로 넘긴다 (DcconPopup의 fetchPage와 같다).
    if (!isRecord(response) || !isRecord(response.info) || !Array.isArray(response.detail) || !Array.isArray(response.tags)) {
        throw new Error("디시콘 정보가 아닙니다.");
    }
    return response;
};

/** 무료 디시콘 패키지를 내 디시콘에 추가한다 (디시 dc_common2.js의 '사용' 버튼). */
export const addDcconPackage = async (packageIdx: string | number): Promise<"ok" | "fail" | "not_login"> => {
    const text = (await ajax.post(urls.dccon.buy, {body: await csrfBody({package_idx: String(packageIdx)})}).text()).trim();
    return text === "ok" || text === "not_login" ? text : "fail";
};

import {ajax} from "@/core/http/client";
import {galltypeOf, galleryKind, urls} from "@/core/http/urls";
import {isRecord} from "@/utils/record";

import {dcBody, resultMessage, submitResult} from "./response";
import type {BlockDay, BlockReason, GalleryPreData} from "./types";

/** 관리 요청 결과. 디시 관리 API는 {"result": "success" | "fail", "msg": "…"}를 돌려준다. */
export interface ManageResult {
    success: boolean;
    /** 디시가 준 안내 문구 (없을 수 있음). */
    message?: string;
}

// 성공이라고 밝힌 응답만 성공으로 본다. 세션이 끊겨 온 HTML이나 "정상적인 접근이 아닙니다." 같은 응답에 성공 알림을 띄우지 않게.
const isSuccess = (result: unknown): boolean => result === "success" || result === "true" || result === true;

type ManageAction = "update_bump" | "delete_list" | "delete_comment" | "update_avoid_list" | "set_notice" | "set_recommend";

/**
 * 관리 요청. 미니 갤러리는 mini_, 나머지(일반·마이너·인물)는 minor_ 관리 API를 쓴다.
 * 필드는 공통 필드(ci_t, _GALLTYPE_) 뒤에 준 순서대로 붙는다. 배열은 같은 이름으로 여러 번 붙인다 (jQuery가 보내는 nos[]=1&nos[]=2).
 */
const manage = async (target: Pick<GalleryPreData, "link">, action: ManageAction, fields: Record<string, string | string[]>): Promise<ManageResult> => {
    const body = await dcBody(target.link, {});
    for (const [key, value] of Object.entries(fields)) for (const item of [value].flat()) body.append(key, item);

    const url = `${urls.base}ajax/${galleryKind(target.link) === "mini" ? "mini" : "minor"}_manager_board_ajax/${action}`;
    const text = (await ajax.post(url, {body}).text()).trim();

    try {
        const parsed: unknown = JSON.parse(text);
        if (isRecord(parsed)) {
            const {result, msg} = parsed;
            return {success: isSuccess(result), message: typeof msg === "string" && msg ? msg : undefined};
        }
    } catch {
        // 아래 텍스트 분기로.
    }

    // JSON 객체가 아니면 "false||메시지" 같은 텍스트다. 맨 'true'·'false'도 JSON.parse가 원시값으로 읽어 여기로 온다.
    const response = submitResult(text);
    return {success: isSuccess(response.result), message: resultMessage(response)};
};

/** 끌올. */
export const bump = (preData: GalleryPreData): Promise<ManageResult> => manage(preData, "update_bump", {id: preData.gallery, "nos[]": preData.id});

/** 게시글 삭제. manage 모듈의 Ctrl+클릭은 목록 행에서 얻은 갤러리·글 번호·주소만 있어 GalleryPreData 전체를 받지 않는다. */
export const deletePost = (target: Pick<GalleryPreData, "gallery" | "id" | "link">): Promise<ManageResult> =>
    manage(target, "delete_list", {id: target.gallery, "nos[]": target.id});

export interface BlockOptions {
    avoidHour: BlockDay;
    avoidReason: BlockReason;
    avoidReasonTxt: string;
    /** 선택한 글도 삭제. */
    delChk: boolean;
    /** 식별 코드 차단 시 IP 동시 차단. */
    userTypeChk: boolean;
}

/**
 * 차단 요청. nos는 차단할 글(parent 빈 값) 또는 댓글(parent에 글 번호) 번호다.
 * 디시 댓글 차단 창(avoid_pop_cmt)은 avoid_submit에 글 번호와 댓글 여부를 넘긴다.
 */
const avoid = (preData: GalleryPreData, nos: string | string[], parent: string, options: BlockOptions): Promise<ManageResult> => manage(preData, "update_avoid_list", {
    id: preData.gallery,
    "nos[]": nos,
    parent,
    avoid_hour: options.avoidHour,
    avoid_reason: options.avoidReason,
    avoid_reason_txt: options.avoidReasonTxt,
    del_chk: options.delChk ? "1" : "0",
    avoid_type_chk: options.userTypeChk ? "1" : "0"
});

/** 유저 차단 (관리 팝업/프리셋). */
export const blockUser = (preData: GalleryPreData, options: BlockOptions): Promise<ManageResult> => avoid(preData, preData.id, "", options);

/** 고른 댓글 작성자를 차단한다 (디시 댓글 목록의 차단 버튼). delChk면 그 댓글도 지운다. */
export const blockCommenters = (preData: GalleryPreData, commentIds: string[], options: BlockOptions): Promise<ManageResult> =>
    avoid(preData, commentIds, preData.id, options);

/** 공지 등록/해제. */
export const setNotice = (preData: GalleryPreData, notice: boolean): Promise<ManageResult> =>
    manage(preData, "set_notice", {mode: notice ? "SET" : "REL", id: preData.gallery, no: preData.id});

/** 개념글 등록/해제. */
export const setRecommend = (preData: GalleryPreData, recommend: boolean): Promise<ManageResult> =>
    manage(preData, "set_recommend", {mode: recommend ? "SET" : "REL", id: preData.gallery, "nos[]": preData.id});

/** 이미지 캡차 URL. */
export const captchaImage = (preData: GalleryPreData, type: "comment" | "recommend"): string =>
    `${urls.base}kcaptcha/image_v3/?gall_id=${preData.gallery}&kcaptcha_type=${type}&time=${Date.now()}&_GALLTYPE_=${galltypeOf(preData.link)}`;

/** 관리자 댓글 삭제. 여러 개를 한 번에 지운다 (디시 del_comment_manager). */
export const adminDeleteComments = (preData: GalleryPreData, commentIds: string[]): Promise<ManageResult> =>
    manage(preData, "delete_comment", {id: preData.gallery, pno: preData.id, "cmt_nos[]": commentIds});

/** 유저 댓글 삭제. */
export const userDeleteComment = async (preData: GalleryPreData, commentId: string, password: string): Promise<ManageResult> => {
    const body = await dcBody(preData.link, {
        id: preData.gallery,
        no: preData.id,
        re_no: commentId,
        mode: "del",
        re_password: password || undefined,
        "g-recaptcha-response": ""
    });

    // 'true'만 성공으로 본다. 관리 요청과 달리 응답이 JSON이 아니다.
    const response = submitResult(await ajax.post(urls.comment_remove, {body}).text());
    return {success: response.result === "true", message: resultMessage(response)};
};

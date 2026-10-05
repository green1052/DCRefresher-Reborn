import {csrfBody} from "@/core/http/cookie";
import {galltypeOf} from "@/core/http/urls";

/** 디시 요청 본문. 모든 요청에 붙는 CSRF 토큰·갤러리 종류 뒤에 fields를 붙인다 (formBody 규칙). */
export const dcBody = (link: string, fields: Parameters<typeof csrfBody>[0]): Promise<URLSearchParams> =>
    csrfBody({_GALLTYPE_: galltypeOf(link), ...fields});

/** 'result||message||detail' 텍스트 응답. 댓글 작성·삭제, 추천, JSON이 아닌 관리 응답이 이 모양이다. */
export interface SubmitResult {
    result: string;
    message?: string;
    /** 'false||captcha||v3'의 v3, 'false||nomember||메시지'의 메시지. */
    detail?: string;
}

export const submitResult = (response: string): SubmitResult => {
    const [result, message, detail] = response.trim().split("||");

    return {result: result ?? "", message, detail};
};

/** 디시가 준 안내 문구. 'false||nomember||메시지'면 문구는 세 번째 칸이다. */
export const resultMessage = ({message, detail}: SubmitResult): string | undefined => (message === "nomember" ? detail : message) || undefined;

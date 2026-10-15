import type {CommentRcKey} from "@/core/messaging/protocol";

/**
 * 디시 JS에서 그대로 옮긴 값. 디시가 바꾸면 쓰기가 실패하므로 e2e/live의 계약 검사가 디시 파일에 아직 그대로 있는지 본다.
 * e2e(Node)도 불러오므로 다른 모듈을 불러오지 않는다.
 */

/** 디시콘·글자콘(insert_icon)은 예전 키를 그대로 쓴다 (디시 dccon.js·txtcon.js). */
export const ICON_SITE_KEY = "6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI";
/**
 * 글 댓글 작성·삭제는 디시 comment.js의 dc_rc_pairs 중 v3 키를 쓴다. 미리보기는 comment.js가 없는 목록에서도 돌아 페이지 값을 읽지 않고 옮겨 둔다.
 * 서버가 rc_key로 같은 쌍의 비밀키를 고르므로 키와 rc_key는 같은 쌍이어야 한다.
 */
export const COMMENT_SITE_KEYS: Record<CommentRcKey, string> = {
    new: "6LfrAuMtAAAAABXdEPC0ZSItQjLjlt2lC4jo3VNX",
    new3: "6LcjA-MtAAAAAIdgo8TKvID6HS34Ac9AkzRjuJfY"
};

/** 디시 _d()의 알파벳 (common.js). 표준 base64 알파벳을 섞은 것이다. */
export const D_ALPHABET = "yL/M=zNa0bcPQdReSfTgUhViWjXkYIZmnpo+qArOBslCt2D3uE4Fv5G6wH178xJ9K";
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

/**
 * 디시 _d()를 옮긴 것. 섞은 알파벳을 표준 알파벳으로 바꿔 base64로 푼다 (65번째 '='는 채움, 모르는 글자는 버린다).
 * s 플래그: 개행도 한 글자로 세어 매핑 표에 없어 버린다. 빠지면 atob가 실패한다. 형식이 틀리면 던진다.
 */
export const decodeD = (value: string): string => atob(value.replace(/./gs, (c) => BASE64[D_ALPHABET.indexOf(c)] ?? ""));

import {formBody} from "@/core/http/client";

/** 디시 CSRF 토큰 (ci_c 쿠키) */
const csrfToken = async (): Promise<string> => (await cookieStore.get("ci_c"))?.value ?? "";

/** CSRF 토큰(ci_t)을 앞에 붙인 디시 요청 본문. fields는 formBody 규칙을 따른다 */
export const csrfBody = async (fields: Parameters<typeof formBody>[0]): Promise<URLSearchParams> => formBody({ci_t: await csrfToken(), ...fields});

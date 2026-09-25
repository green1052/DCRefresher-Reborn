/** 디시 CSRF 토큰 (ci_c 쿠키) — 요청 body의 ci_t로 보낸다 */
export const csrfToken = async (): Promise<string> => (await cookieStore.get("ci_c"))?.value ?? "";

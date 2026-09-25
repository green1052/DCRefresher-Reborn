/** 디시 CSRF 토큰 (ci_c 쿠키) */
export const csrfToken = async (): Promise<string> => (await cookieStore.get("ci_c"))?.value ?? "";

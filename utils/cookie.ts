/** cookieStore 래퍼 — Firefox 등 미지원 환경은 document.cookie로 폴백 */
export const getCookie = async (name: string): Promise<string | undefined> => {
    if (typeof cookieStore !== "undefined") {
        try {
            return (await cookieStore.get(name))?.value;
        } catch {
            // 폴백으로 진행
        }
    }

    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1] ?? "") : undefined;
};

export const setCookie = async (cookie: {name: string; value: string; expires?: number; path?: string}): Promise<void> => {
    if (typeof cookieStore !== "undefined") {
        try {
            await cookieStore.set(cookie);
            return;
        } catch {
            // 폴백으로 진행
        }
    }

    const parts = [`${cookie.name}=${cookie.value}`, `path=${cookie.path ?? "/"}`];
    if (cookie.expires) parts.push(`expires=${new Date(cookie.expires).toUTCString()}`);
    document.cookie = parts.join("; ");
};

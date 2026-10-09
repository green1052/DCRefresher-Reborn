import {onMessage} from "@/core/messaging/protocol";
import {hasTab, runInPage} from "@/core/module/background";

const GRECAPTCHA_SITE_KEY = "6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI";
/** api.js가 막히면(광고 차단 등) 끝나지 않으므로 이 시간까지만 기다린다. */
const GRECAPTCHA_TIMEOUT = 15_000;

/**
 * 탭의 페이지 컨텍스트에서 실행된다(직렬화되므로 바깥 변수를 쓰지 않는다).
 * api.js는 이때 처음 불러온다. 미리 넣으면 원래 comment.js의 typeof grecaptcha 검사 결과가 바뀌어 v2 체크박스가 뜬다.
 */
const executeGrecaptcha = async (siteKey: string, action: string): Promise<string> => {
    type Grecaptcha = { ready: (callback: () => void) => void; execute: (key: string, options: { action: string }) => Promise<string> };
    const scope = window as Window & { grecaptcha?: Grecaptcha };

    if (!scope.grecaptcha) {
        await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("api.js"));
            document.head.append(script);
        });
    }

    const grecaptcha = scope.grecaptcha!;
    await new Promise<void>((resolve) => grecaptcha.ready(resolve));
    return grecaptcha.execute(siteKey, {action});
};

/**
 * 탭의 페이지 컨텍스트에서 실행된다(직렬화되므로 바깥 변수를 쓰지 않는다).
 * 디시는 자체 차단(block-disable)과 이용자 메모 배지를 목록을 처음 그릴 때만 적용하므로 교체한 행에 다시 건다.
 * 해당 함수가 없는 페이지면 건너뛴다.
 */
const rerunListScripts = (gallery: string): void => {
    const scope = window as Window & {
        chk_user_block?: (id: string) => void;
        UserMemo?: { renderWriterMemoBadges?: (wrapper: null) => void };
    };

    // 디시가 페이지를 열 때 넘긴 값을 그대로 쓴다. 미니 갤러리는 목록('id')과 글 페이지('mi$id')의 값이 달라 id로 짐작하면 다른 설정을 읽는다.
    // 목록을 바꿀 때마다 불리므로 찾으면 멈춘다 (배열로 펼쳐 map하면 페이지의 인라인 스크립트를 모두 훑는다).
    const loaded = Iterator.from(document.scripts).map((script) => /chk_user_block\('([^']*)'\)/.exec(script.textContent ?? "")?.[1]).find((id) => id !== undefined);
    if (typeof scope.chk_user_block === "function") scope.chk_user_block(loaded ?? gallery);
    // null이면 디시가 처음 그릴 때 등록한 범위(목록·글 머리)를 다시 그린다.
    if (typeof scope.UserMemo?.renderWriterMemoBadges === "function") scope.UserMemo.renderWriterMemoBadges(null);
};

/** 콘텐츠 스크립트가 요청하면 그 탭의 페이지(MAIN world)에서 대신 실행한다. */
export const listenPageMessages = (): void => {
    // reCAPTCHA: 디시가 v3 토큰을 요구할 때만 받아 온다. 토큰은 디시 도메인에서 실행해야 유효하다. 상주 스크립트 없이 필요할 때 한 번만 주입한다.
    onMessage("refresher:grecaptchaToken", async ({data: action, sender}) => {
        if (!hasTab(sender)) return undefined;

        try {
            const injection = runInPage(sender, executeGrecaptcha, [GRECAPTCHA_SITE_KEY, action]);
            // 시간 초과가 이긴 뒤 탭이 닫혀 실패해도 처리되지 않은 거절로 남지 않게 한다.
            injection.catch(() => {});
            const timeout = new Promise<undefined>((resolve) => setTimeout(resolve, GRECAPTCHA_TIMEOUT));
            const [result] = (await Promise.race([injection, timeout])) ?? [];
            return typeof result?.result === "string" ? result.result : undefined;
        } catch {
            return undefined;
        }
    });

    // 목록 교체: 갈아끼운 행에 디시의 자체 차단·메모 표시를 다시 건다.
    onMessage("refresher:listReplaced", async ({data: gallery, sender}) => {
        if (!hasTab(sender)) return;

        await runInPage(sender, rerunListScripts, [gallery]).catch(() => {});
    });
};

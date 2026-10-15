import {type CommentRcKey, onMessage} from "@/core/messaging/protocol";
import {defineBackgroundModule, hasTab, runInPage} from "@/core/module/background";

/** 디시콘·글자콘(insert_icon)은 예전 키를 그대로 쓴다 (디시 dccon.js·txtcon.js). */
const ICON_SITE_KEY = "6Lc-Fr0UAAAAAOdqLYqPy53MxlRMIXpNXFvBliwI";
/**
 * 글 댓글 작성·삭제는 디시 comment.js의 dc_rc_pairs 중 v3 키를 쓴다. 미리보기는 comment.js가 없는 목록에서도 돌아 페이지 값을 읽지 않고 옮겨 둔다.
 * 서버가 rc_key로 같은 쌍의 비밀키를 고르므로 키와 rc_key는 같은 쌍이어야 한다.
 */
const COMMENT_SITE_KEYS: Record<CommentRcKey, string> = {
    new: "6LfrAuMtAAAAABXdEPC0ZSItQjLjlt2lC4jo3VNX",
    new3: "6LcjA-MtAAAAAIdgo8TKvID6HS34Ac9AkzRjuJfY"
};
/** api.js가 막히면(광고 차단 등) 끝나지 않으므로 이 시간까지만 기다린다. */
const GRECAPTCHA_TIMEOUT = 15_000;

/**
 * 탭의 페이지 컨텍스트에서 실행된다(직렬화되므로 바깥 변수를 쓰지 않는다).
 * api.js는 이때 처음 불러온다. 미리 넣으면 원래 comment.js의 typeof grecaptcha 검사 결과가 바뀌어 v2 체크박스가 뜬다.
 */
const executeGrecaptcha = async (siteKey: string, action: string): Promise<string> => {
    type Grecaptcha = {
        ready: (callback: () => void) => void;
        render: (container: HTMLElement, parameters: { sitekey: string; size: "invisible" }) => number;
        execute: (key: string | number, options: { action: string }) => Promise<string>;
    };
    const scope = window as Window & { grecaptcha?: Grecaptcha; refresherRecaptchaWidgets?: Record<string, number> };

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
    try {
        return await grecaptcha.execute(siteKey, {action});
    } catch {
        // api.js가 이미 다른 키로 떠 있으면(디시 comment.js나 앞선 디시콘 재전송) 그 키만 실행할 수 있어 던진다.
        // 이 키로 보이지 않는 위젯을 따로 그려 실행한다. 키마다 한 번만 그려 두고 다시 쓴다 — 매번 그리면 위젯과 배지가 쌓인다.
        const widgets = (scope.refresherRecaptchaWidgets ??= {});
        widgets[siteKey] ??= grecaptcha.render(document.body.appendChild(document.createElement("div")), {sitekey: siteKey, size: "invisible"});
        return grecaptcha.execute(widgets[siteKey], {action});
    }
};

/** 미리보기: 댓글·디시콘 작성과 댓글 삭제에 쓸 reCAPTCHA 토큰을 탭의 페이지(MAIN world)에서 받아 온다. */
export default defineBackgroundModule({
    // meta.ts는 아이콘(lucide·Preact)을 불러오므로 id만 같게 적는다.
    id: "preview",

    listen() {
        // reCAPTCHA: 디시가 v3 토큰을 요구할 때만 받아 온다. 토큰은 디시 도메인에서 실행해야 유효하다. 상주 스크립트 없이 필요할 때 한 번만 주입한다.
        onMessage("refresher:grecaptchaToken", async ({data, sender}) => {
            if (!hasTab(sender)) return undefined;

            try {
                const siteKey = data.action === "insert_icon" ? ICON_SITE_KEY : COMMENT_SITE_KEYS[data.rcKey];
                const injection = runInPage(sender, executeGrecaptcha, [siteKey, data.action]);
                // 시간 초과가 이긴 뒤 탭이 닫혀 실패해도 처리되지 않은 거절로 남지 않게 한다.
                injection.catch(() => {});
                const timeout = new Promise<undefined>((resolve) => setTimeout(resolve, GRECAPTCHA_TIMEOUT));
                const [result] = (await Promise.race([injection, timeout])) ?? [];
                return typeof result?.result === "string" ? result.result : undefined;
            } catch {
                return undefined;
            }
        });
    }
});

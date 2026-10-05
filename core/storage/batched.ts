import type {ModuleContext} from "@/core/module/types";

/**
 * 모아 저장하기. 저장할 때마다 값 전체가 열린 디시 탭마다(크롬은 서비스 워커에도) 전달되므로, 자주 바뀌는 캐시는 모아서 쓴다.
 * schedule()은 delay 뒤에 한 번 쓰고(이미 잡혀 있으면 그대로 둔다), 탭을 숨기거나 떠날 때와 모듈이 멈출 때는 바로 쓴다.
 * write는 저장소 호출 한 번이어야 한다. 페이지를 떠날 때는 읽고 쓰는 두 번째 호출까지 가지 못한다.
 * 쓸 것이 없으면 write가 그냥 돌아온다.
 */
export const batchedSave = (ctx: Pick<ModuleContext, "signal" | "addCleanup">, delay: number, write: () => Promise<void> | void) => {
    let timer = 0;

    const flush = (): void => {
        window.clearTimeout(timer);
        timer = 0;
        try {
            void Promise.resolve(write()).catch(console.error);
        } catch (e) {
            console.error(e);
        }
    };
    const schedule = (): void => {
        timer ||= window.setTimeout(flush, delay);
    };

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) flush();
    }, {signal: ctx.signal});
    window.addEventListener("pagehide", flush, {signal: ctx.signal});
    ctx.addCleanup(flush);

    return {schedule, flush};
};

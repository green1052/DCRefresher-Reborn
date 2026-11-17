import type {ModuleContext} from "@/core/module/types";

/** 저장 시마다 값 전체가 열린 탭마다 전달되므로 모아서 쓴다. 숨기거나 떠날 때는 바로 쓴다. */
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

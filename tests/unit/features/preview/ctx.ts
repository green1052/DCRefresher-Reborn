/** 미리보기 모듈의 가짜 실행 컨텍스트. 레지스트리 없이 기능 함수(read·keyboard·mini·rows-input)를 돌린다. */
import type {Ctx} from "@/features/preview/meta";

type Settings = { -readonly [K in keyof Ctx["settings"]]: Ctx["settings"][K] };

const defaults = (): Settings => ({
    previewWidth: 1200,
    toggleBackgroundBlur: false,
    scrollToSkip: true,
    tooltipMode: false,
    tooltipMediaHide: false,
    tooltipDelay: 300,
    tooltipInteraction: false,
    reversePreviewKey: false,
    longPressDelay: 300,
    colorPreviewLink: true,
    autoRefreshComment: false,
    highlightNewComments: true,
    commentRefreshInterval: 10000,
    toggleAdminPanel: true,
    useKeyPress: true,
    deleteKey: "d",
    blockKey: "b",
    blockPresetDay: "1",
    blockPresetDelete: false,
    blockPresetUserType: false,
    blockPresetReason: "",
    expandRecognizeRange: false,
    imageViewer: true,
    markRead: true,
    listKeyboard: true,
    disableCache: false,
    archiveArticle: false,
    blockImage: false
});

/**
 * settings는 고칠 수 있다. addFilter는 지금 있는 요소에 바로, 이후 붙는 요소에는 MutationObserver로 부른다.
 * stop()은 모듈이 멈출 때처럼 signal을 끊고 정리 함수를 부른다.
 */
export const fakeCtx = (overrides: Partial<Settings> = {}) => {
    const settings = {...defaults(), ...overrides};
    const controller = new AbortController();
    const cleanups: (() => void)[] = [];
    const settingsListeners: ((keys: ReadonlySet<keyof Settings & string>) => void)[] = [];

    const ctx: Ctx = {
        settings,
        signal: controller.signal,
        addFilter: (scope, callback) => {
            for (const element of document.querySelectorAll<HTMLElement>(scope)) callback(element);
            const observer = new MutationObserver((records) => {
                for (const record of records) {
                    for (const node of record.addedNodes) {
                        if (!(node instanceof HTMLElement)) continue;
                        if (node.matches(scope)) callback(node);
                        for (const element of node.querySelectorAll<HTMLElement>(scope)) callback(element);
                    }
                }
            });
            observer.observe(document, {childList: true, subtree: true});
            const dispose = () => observer.disconnect();
            cleanups.push(dispose);
            return dispose;
        },
        addCleanup: (dispose) => void cleanups.push(dispose),
        onSettingsChanged: (listener) => void settingsListeners.push(listener)
    };

    /** 설정을 바꾸고 바뀐 키를 알린다. */
    const change = (patch: Partial<Settings>): void => {
        Object.assign(settings, patch);
        const keys = new Set(Object.keys(patch).filter((key): key is keyof Settings => key in settings));
        for (const listener of settingsListeners) listener(keys);
    };

    const stop = (): void => {
        controller.abort();
        for (const dispose of cleanups.splice(0)) dispose();
    };

    return {ctx, settings, change, stop};
};

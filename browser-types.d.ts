import "@wxt-dev/browser";

// @wxt-dev/browser는 크롬 타입이라 파이어폭스 전용 API가 없다
declare module "@wxt-dev/browser" {
    export namespace Browser {
        export namespace commands {
            /** 파이어폭스 137+. about:addons의 단축키 설정을 연다 */
            export function openShortcutSettings(): Promise<void>;
        }
    }
}

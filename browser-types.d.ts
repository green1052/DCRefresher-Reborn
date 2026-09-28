import "@wxt-dev/browser";
import type {Commands} from "webextension-polyfill";

// @wxt-dev/browser는 크롬 타입이라 파이어폭스 전용 API가 없다. 파이어폭스 스키마로 만든 타입(@types/webextension-polyfill)에서 가져온다 (WXT 문서 "Add Firefox Types")
declare module "@wxt-dev/browser" {
    export namespace Browser {
        export namespace commands {
            /** 파이어폭스 137+. about:addons의 단축키 설정을 연다 */
            export const openShortcutSettings: Commands.Static["openShortcutSettings"];
        }
    }
}

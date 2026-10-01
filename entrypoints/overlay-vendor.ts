import * as radixUi from "radix-ui";
import * as radixInternal from "radix-ui/internal";
import * as reactDomClient from "react-dom/client";

/**
 * 오버레이 UI 라이브러리 (modules/overlay-vendor.ts). 오버레이를 처음 띄울 때 배경이 콘텐츠 스크립트와 같은 격리 환경에 주입한다.
 * 여기서 쓰는 react는 콘텐츠 스크립트가 넘긴 것이다.
 */
export default defineUnlistedScript(() => {
    (globalThis as { __refresherVendor?: unknown }).__refresherVendor = {radixUi, radixInternal, reactDomClient};
});

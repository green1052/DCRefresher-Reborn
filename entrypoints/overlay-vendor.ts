import * as radixUi from "radix-ui";
import * as radixInternal from "radix-ui/internal";
import * as reactDomClient from "react-dom/client";

import {provideOverlayVendor} from "@/components/overlay/vendor";

/**
 * 오버레이 라이브러리. 오버레이를 처음 띄울 때 배경이 콘텐츠 스크립트와 같은 격리 world에 넣는다.
 * 빌드는 콘텐츠 스크립트가 쓰는 이름만 남기고, react는 콘텐츠 스크립트의 것을 쓴다 (modules/overlay-vendor.ts).
 */
export default defineUnlistedScript(() => provideOverlayVendor({radixUi, radixInternal, reactDomClient}));

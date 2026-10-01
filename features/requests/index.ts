import {setRequestConcurrency} from "@/core/http/client";
import {defineModule} from "@/core/module/define";

import meta from "./meta";

export default defineModule({
    ...meta,

    setup(ctx) {
        setRequestConcurrency(ctx.settings.concurrency);
        ctx.onSettingsChanged(() => setRequestConcurrency(ctx.settings.concurrency));
    },
    // 모듈을 끄면 제한하지 않는다.
    revoke: () => setRequestConcurrency(Number.POSITIVE_INFINITY)
});

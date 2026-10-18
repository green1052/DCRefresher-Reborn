import {setRequestConcurrency} from "@/core/http/client";
import {defineModule} from "@/core/module/define";

import meta from "./meta";

export default defineModule(meta, {
    setup(ctx) {
        ctx.onRevoke(() => setRequestConcurrency(Number.POSITIVE_INFINITY));

        setRequestConcurrency(ctx.settings.concurrency);
        ctx.onSettingsChanged(() => setRequestConcurrency(ctx.settings.concurrency));
    }
});

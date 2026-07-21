import {PreviewController, type PreviewStatus} from "./controller";
import {PostCache} from "./cache";
import {createMiniPreview, type MiniPreviewState} from "./miniPreview";
import {previewSettings, type PreviewSettingsMap} from "./previewSettings";
import {queryString} from "@/http/http";

interface PreviewMemory {
    controller: PreviewController | null;

    [key: string]: unknown;
}

const postCaches = new PostCache();
const miniPreview: MiniPreviewState = createMiniPreview();

export default {
    name: "미리보기",
    description: "글을 오른쪽 클릭 했을때 미리보기 창을 만들어줍니다.",
    url: /\/board\/(view|lists)/,
    status: {},
    memory: {
        controller: null
    },
    enable: true,
    default_enable: true,
    settings: previewSettings,
    async func() {
        this.memory.controller = new PreviewController(
            this.status as PreviewStatus,
            postCaches,
            miniPreview,
            queryString("id") ?? undefined
        );
        await this.memory.controller.setup();
    },
    revoke() {
        this.memory.controller?.destroy();
        this.memory.controller = null;
    }
} as RefresherModule<{
    memory: PreviewMemory;
    settings: PreviewSettingsMap;
}>;
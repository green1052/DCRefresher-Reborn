import {defineModule} from "@/core/module/define";
import {eventTarget} from "@/utils/event";

let currentImage: string | null = null;

const searchWith = (targetUrl: string): void => {
    if (!currentImage?.includes("viewimage.php")) return;

    // 디시콘 이미지로 통일 (호스트/경로만 교체, 쿼리 유지)
    const url = new URL(currentImage);
    url.host = "image.dcinside.com";
    url.pathname = "/dccon.php";

    window.open(targetUrl.replace("[url]", encodeURIComponent(url.toString())));
};

export default defineModule({
    id: "imagesearch",
    name: "이미지 검색",
    description: "이미지를 검색합니다.",
    defaultEnable: true,

    setup(ctx) {
        const onContextMenu = (event: MouseEvent): void => {
            const target = eventTarget(event);
            if (target instanceof HTMLImageElement && target.src) {
                currentImage = target.src;
            }
        };

        window.addEventListener("contextmenu", onContextMenu);
        ctx.addCleanup(() => window.removeEventListener("contextmenu", onContextMenu));

        const offImageSearch = ctx.bus.on("imageSearch", () => searchWith("https://saucenao.com/search.php?url=[url]"));
        ctx.addCleanup(() => void offImageSearch());
    }
});

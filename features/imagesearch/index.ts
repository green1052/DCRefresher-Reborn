import {defineModule} from "@/core/module/define";

/** 디시 본문 이미지(viewimage.php)만 — 우클릭한 이미지 주소는 배경의 컨텍스트 메뉴가 넘겨 준다 */
const searchSauceNao = (src: string): void => {
    if (!src.includes("viewimage.php")) return;

    // 디시콘 이미지로 통일 (호스트/경로만 교체, 쿼리 유지)
    const url = new URL(src);
    url.host = "image.dcinside.com";
    url.pathname = "/dccon.php";

    window.open(`https://saucenao.com/search.php?url=${encodeURIComponent(url.toString())}`);
};

export default defineModule({
    id: "imagesearch",
    name: "이미지 검색",
    description: "이미지를 검색합니다.",
    defaultEnable: true,

    setup(ctx) {
        const offImageSearch = ctx.bus.on("imageSearch", ({data: src}) => searchSauceNao(src));
        ctx.addCleanup(() => void offImageSearch());
    }
});

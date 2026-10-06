import {documentUrl} from "@/core/http/urls";
import {WRITE_PAGE} from "@/core/pages";

/**
 * 확장이 업데이트되거나 꺼져 이 페이지에서 멈췄다고 알린다.
 * 기능이 조용히 멈추면 이유를 알 수 없으므로 알린다. WXT가 무효화 때 오버레이를 걷어 내므로 토스트 대신 DOM에 직접 띄운다.
 * manifest CSS도 확장과 함께 빠질 수 있어 인라인 스타일을 쓴다. 누르면 닫힌다.
 * 업데이트·다시 불러오기·끄기·삭제 모두 여기로 온다. 글쓰기 페이지에서 바로 새로고침하면 작성 중인 글을 잃는다.
 */
export const showInvalidatedNote = (): void => {
    const note = document.createElement("div");
    note.setAttribute("role", "status");
    note.textContent = `확장 프로그램이 업데이트되었거나 꺼져서 이 페이지에서는 멈췄습니다. ${
        WRITE_PAGE.test(documentUrl.href) ? "작성 중인 글은 등록한 뒤 새로고침해 주세요." : "새로고침해 주세요."
    }`;
    note.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:10px 14px;border-radius:8px;background:#333;color:#fff;font-size:13px;cursor:pointer";
    note.addEventListener("click", () => note.remove());
    document.body?.append(note);
};

import {ChevronLeft, ChevronRight, ExternalLink, X} from "lucide-react";
import {useLayoutEffect, useRef, useState} from "react";

import {keepTabInside} from "@/components/dialogs";
import {useReturnFocus} from "@/components/useReturnFocus";
import {dcinsideHref} from "@/core/http/urls";
import {hasModifier} from "@/utils/event";
import {cn} from "cn";

import {usePreviewStore, type ViewerImage} from "./previewStore";

const close = (): void => usePreviewStore.setState({viewer: null});

/** 세로가 가로의 이만큼보다 길면 화면 높이에 맞추지 않고 폭에 맞춰 세로로 스크롤한다. 높이에 맞추면 폭이 몇십 px로 줄어 안 보인다. */
const LONG_RATIO = 2.5;

/**
 * 본문 이미지 크게 보기 (imageViewer 설정). 본문 이미지를 누르면 Frame이 연다. ←/→로 넘기고 Esc, 바깥 클릭으로 닫는다.
 * 미리보기 창 위의 모달이라 Esc는 이 창만 닫는다 (위에 뜬 것부터 닫는다).
 * native <dialog> - top-layer·배경·Tab 가두기·Esc를 브라우저가 맡는다.
 */
export const ImageViewer = ({images, index}: { images: ViewerImage[]; index: number }) => {
    // 긴 이미지로 읽힌 주소. 넘기면 새 이미지가 다시 읽힐 때까지 보통 이미지로 둔다.
    const [longSrc, setLongSrc] = useState<string>();
    const dialog = useRef<HTMLDialogElement>(null);
    // Esc/바깥 클릭으로 닫히면 연 이미지로 포커스를 돌려준다. 컴포넌트째 언마운트되므로 cleanup이 닫는 역할을 한다.
    useReturnFocus(dialog);
    const image = images[index];

    useLayoutEffect(() => {
        dialog.current?.showModal();
    }, []);

    if (!image) return null;

    const go = (dir: number): void => {
        dialog.current?.scrollTo({top: 0});
        usePreviewStore.setState({viewer: {images, index: (index + dir + images.length) % images.length}});
    };
    // 디시 원본 보기 주소(imgPop)만 연다.
    const original = dcinsideHref(image.pop);

    const onDark = "text-white/85 hover:bg-white/10 hover:text-white";

    return (
        <dialog
            ref={dialog}
            data-slot="dialog-overlay"
            data-viewer
            // items-start: 긴 이미지가 세로 가운데에 걸려 윗부분으로 못 스크롤하는 일이 없게 한다(이미지의 m-auto가 가운데를 맞춘다).
            className="refresher-viewer fixed inset-0 flex items-start overflow-y-auto px-18 py-14 outline-none duration-150 animate-in fade-in"
            onCancel={(ev) => {
                // 기본 닫기는 브라우저가 창만 닫으므로 막고 스토어를 비워 언마운트한다.
                ev.preventDefault();
                close();
            }}
            onKeyDown={(ev) => {
                // Chromium의 모달 Tab 순환은 창 요소를 거치는 빈 돌점에서 포커스가 shadow 밖으로 샌다(dialogs.tsx 참고).
                keepTabInside(ev);
                if (images.length < 2 || (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight")) return;
                // 조합키는 브라우저 몫이다 (Alt+←는 뒤로 가기). 다른 미리보기 단축키처럼 넘기지 않는다.
                if (hasModifier(ev)) return;
                ev.preventDefault();
                go(ev.key === "ArrowLeft" ? -1 : 1);
            }}
            // 이미지와 버튼 밖(빈 곳)을 누르면 닫는다.
            onClick={(ev) => ev.target === ev.currentTarget && close()}
        >
            <h2 className="sr-only">이미지 크게 보기</h2>
            <img src={image.src} alt={image.alt || `본문 이미지 ${index + 1}`}
                 className={cn("m-auto max-w-full select-none", longSrc !== image.src && "max-h-full object-contain")}
                 onLoad={(ev) => {
                     const {naturalWidth, naturalHeight} = ev.currentTarget;
                     if (naturalHeight > naturalWidth * LONG_RATIO) setLongSrc(image.src);
                 }}/>

            <div className="fixed top-3 right-4 flex items-center gap-4">
                {/* 넘길 때 몇 번째인지 화면 낭독기에도 알린다. */}
                {images.length > 1 && <span className="text-white/85" aria-live="polite">{index + 1} / {images.length}</span>}
                {original && (
                    <a className={cn("btn btn-ghost btn-square", onDark)} href={original} target="_blank" rel="noopener noreferrer"
                       aria-label="원본 보기" title="원본 보기">
                        <ExternalLink className="size-4"/>
                    </a>
                )}
                <button type="button" className={cn("btn btn-ghost btn-square", onDark)} aria-label="닫기" title="닫기" onClick={close}>
                    <X className="size-4"/>
                </button>
            </div>

            {images.length > 1 && (
                <>
                    <button type="button" className="btn btn-secondary btn-square btn-lg fixed top-1/2 left-4 -translate-y-1/2 rounded-full" aria-label="이전 이미지"
                            onClick={() => go(-1)}><ChevronLeft className="size-4"/></button>
                    <button type="button" className="btn btn-secondary btn-square btn-lg fixed top-1/2 right-4 -translate-y-1/2 rounded-full" aria-label="다음 이미지"
                            onClick={() => go(1)}><ChevronRight className="size-4"/></button>
                </>
            )}
        </dialog>
    );
}

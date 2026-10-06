import {Dialog} from "@base-ui/react/dialog";
import {ChevronLeft, ChevronRight, ExternalLink, X} from "lucide-react";
import {useRef, useState} from "react";

import {overlay} from "@/components/overlay/shadow";
import {Button} from "@/components/ui/button";
import {dcinsideHref} from "@/core/http/urls";
import {cn} from "cn";

import {usePreviewStore, type ViewerImage} from "./previewStore";

const close = (): void => usePreviewStore.setState({viewer: null});

/** 세로가 가로의 이만큼보다 길면 화면 높이에 맞추지 않고 폭에 맞춰 세로로 스크롤한다. 높이에 맞추면 폭이 몇십 px로 줄어 안 보인다. */
const LONG_RATIO = 2.5;


/**
 * 본문 이미지 크게 보기 (imageViewer 설정). 본문 이미지를 누르면 Frame이 연다. ←/→로 넘기고 Esc·바깥 클릭으로 닫는다.
 * 미리보기 창 위의 모달이라 Esc는 이 창만 닫는다 (위에 뜬 것부터 닫는다).
 */
export const ImageViewer = ({images, index}: { images: ViewerImage[]; index: number }) => {
    // 긴 이미지로 읽힌 주소. 넘기면 새 이미지가 다시 읽힐 때까지 보통 이미지로 둔다.
    const [longSrc, setLongSrc] = useState<string>();
    const popup = useRef<HTMLDivElement>(null);
    const image = images[index];
    if (!image) return null;

    const go = (dir: number): void => {
        popup.current?.scrollTo({top: 0});
        usePreviewStore.setState({viewer: {images, index: (index + dir + images.length) % images.length}});
    };
    // 디시 원본 보기 주소(imgPop)만 연다.
    const original = dcinsideHref(image.pop);

    // 어두운 배경 위라 밝은 글자·아이콘을 쓴다.
    const onDark = "text-white/85 hover:bg-white/10 hover:text-white";

    return (
        <Dialog.Root open onOpenChange={(open) => !open && close()}>
            <Dialog.Portal container={overlay.portal}>
                <Dialog.Backdrop className="fixed inset-0 bg-black/85 duration-150 animate-in fade-in"/>
                <Dialog.Popup
                    ref={popup}
                    className="refresher-viewer fixed inset-0 flex overflow-y-auto px-18 py-14 outline-none duration-150 animate-in fade-in"
                    onKeyDown={(ev) => {
                        if (images.length < 2 || (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight")) return;
                        ev.preventDefault();
                        go(ev.key === "ArrowLeft" ? -1 : 1);
                    }}
                    // 이미지와 버튼 밖(빈 곳)을 누르면 닫는다.
                    onClick={(ev) => ev.target === ev.currentTarget && close()}
                >
                    <Dialog.Title className="sr-only">이미지 크게 보기</Dialog.Title>
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
                            <Button size="icon" variant="ghost" className={onDark} aria-label="원본 보기" title="원본 보기" nativeButton={false}
                                    render={<a href={original} target="_blank" rel="noopener noreferrer"/>}>
                                <ExternalLink/>
                            </Button>
                        )}
                        <Dialog.Close render={<Button size="icon" variant="ghost" className={onDark} aria-label="닫기" title="닫기"/>}>
                            <X/>
                        </Dialog.Close>
                    </div>

                    {images.length > 1 && (
                        <>
                            <Button size="icon-lg" variant="secondary" className="fixed top-1/2 left-4 -translate-y-1/2 rounded-full" aria-label="이전 이미지"
                                    onClick={() => go(-1)}><ChevronLeft/></Button>
                            <Button size="icon-lg" variant="secondary" className="fixed top-1/2 right-4 -translate-y-1/2 rounded-full" aria-label="다음 이미지"
                                    onClick={() => go(1)}><ChevronRight/></Button>
                        </>
                    )}
                </Dialog.Popup>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

import {IconButton, Text, Theme, VisuallyHidden} from "@radix-ui/themes";
import {ChevronLeft, ChevronRight, ExternalLink, X} from "lucide-react";
import {Dialog} from "radix-ui";

import {overlay} from "@/components/overlay/shadow";

import {usePreviewStore, type ViewerImage} from "./previewStore";

const close = (): void => usePreviewStore.setState({viewer: null});

/** 디시 원본 보기 주소(imgPop)만 연다. 정화를 거친 본문이라도 다른 곳으로 가는 주소는 열지 않는다. */
const originalUrl = (image: ViewerImage): string | undefined => {
    const url = image.pop ? URL.parse(image.pop) : null;
    return url?.protocol === "https:" && url.hostname.endsWith(".dcinside.com") ? url.href : undefined;
};

/**
 * 본문 이미지 크게 보기 (imageViewer 설정). 본문 이미지를 누르면 Frame이 연다. ←/→로 넘기고 Esc·바깥 클릭으로 닫는다.
 * 미리보기 창 위의 모달이라 Esc는 이 창만 닫는다 (Radix가 위에 뜬 것부터 닫는다).
 */
export const ImageViewer = ({images, index}: { images: ViewerImage[]; index: number }) => {
    const image = images[index];
    if (!image) return null;

    const go = (dir: number): void => usePreviewStore.setState({viewer: {images, index: (index + dir + images.length) % images.length}});
    const original = originalUrl(image);

    return (
        <Dialog.Root open onOpenChange={(open) => !open && close()}>
            <Dialog.Portal container={overlay.portal}>
                {/* 프리미티브 포털은 Theme 밖에 그려지므로 Theme로 다시 감싼다 (Frame과 같다). */}
                <Theme>
                    <Dialog.Overlay className="refresher-viewer-backdrop"/>
                    <Dialog.Content
                        className="refresher-viewer"
                        aria-describedby={undefined}
                        onKeyDown={(ev) => {
                            if (images.length < 2 || (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight")) return;
                            ev.preventDefault();
                            go(ev.key === "ArrowLeft" ? -1 : 1);
                        }}
                        // 이미지와 버튼 밖(빈 곳)을 누르면 닫는다.
                        onClick={(ev) => ev.target === ev.currentTarget && close()}
                    >
                        <VisuallyHidden><Dialog.Title>이미지 크게 보기</Dialog.Title></VisuallyHidden>
                        <img src={image.src} alt={image.alt || `본문 이미지 ${index + 1}`}/>

                        <div className="refresher-viewer-bar">
                            {/* 넘길 때 몇 번째인지 화면 낭독기에도 알린다. */}
                            {images.length > 1 && <Text size="2" aria-live="polite">{index + 1} / {images.length}</Text>}
                            {original && (
                                <IconButton asChild size="2" variant="ghost" color="gray" aria-label="원본 보기" title="원본 보기">
                                    <a href={original} target="_blank" rel="noopener noreferrer"><ExternalLink size={18}/></a>
                                </IconButton>
                            )}
                            <Dialog.Close asChild>
                                <IconButton size="2" variant="ghost" color="gray" aria-label="닫기" title="닫기"><X size={18}/></IconButton>
                            </Dialog.Close>
                        </div>

                        {images.length > 1 && (
                            <>
                                <IconButton className="refresher-viewer-prev" size="3" variant="soft" color="gray" radius="full" aria-label="이전 이미지"
                                            onClick={() => go(-1)}><ChevronLeft/></IconButton>
                                <IconButton className="refresher-viewer-next" size="3" variant="soft" color="gray" radius="full" aria-label="다음 이미지"
                                            onClick={() => go(1)}><ChevronRight/></IconButton>
                            </>
                        )}
                    </Dialog.Content>
                </Theme>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

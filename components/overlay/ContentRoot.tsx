import {type ComponentType, useState} from "react";

import {TooltipProvider} from "@/components/ui/tooltip";
import {usePreviewStore} from "@/features/preview/ui/previewStore";
import type {SelectedUser} from "@/stores/ui";

import {MemoDialog} from "./MemoDialog";
import {ToastHost} from "./Toasts";
import {BubbleHost, DcconPackageDialog} from "./UserBubble";

// 기능별 오버레이 호스트 (features/<id>/overlay.tsx의 default). 스타일(feature-styles.ts)처럼 모아 그린다.
const featureHosts = Object.entries(import.meta.glob<{ default: ComponentType }>("../../features/*/overlay.tsx", {eager: true}));

export const ContentRoot = () => {
    // 버블은 누르면 닫히므로 패키지 차단 다이얼로그의 대상은 여기에 둔다.
    const [packageTarget, setPackageTarget] = useState<SelectedUser | null>(null);

    return (
        // 다크모드는 오버레이 최상위 요소의 light/dark 클래스가 정한다 (entrypoints/content/overlay.tsx의 followDcAppearance).
        <TooltipProvider>
            <ToastHost/>
            <BubbleHost onBlockPackage={setPackageTarget} onDcconInfo={(code) => usePreviewStore.setState({dcconInfo: code})}/>
            {packageTarget && <DcconPackageDialog target={packageTarget} onClose={() => setPackageTarget(null)}/>}
            <MemoDialog/>
            {featureHosts.map(([path, {default: Host}]) => <Host key={path}/>)}
        </TooltipProvider>
    );
};

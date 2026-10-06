import {useState} from "react";

import {PreviewHost} from "@/features/preview/ui/PreviewHost";
import type {SelectedUser} from "@/stores/ui";

import {MemoDialog} from "./MemoDialog";
import {ToastHost} from "./Toasts";
import {BubbleHost, DcconPackageDialog} from "./UserBubble";

export const ContentRoot = () => {
    // 버블은 누르면 닫히므로 패키지 차단 다이얼로그의 대상은 여기에 둔다.
    const [packageTarget, setPackageTarget] = useState<SelectedUser | null>(null);

    return (
        // 다크모드는 오버레이 최상위 요소의 light/dark 클래스가 정한다 (entrypoints/content/overlay.tsx의 followDcAppearance).
        <>
            <ToastHost/>
            <BubbleHost onBlockPackage={setPackageTarget}/>
            {packageTarget && <DcconPackageDialog target={packageTarget} onClose={() => setPackageTarget(null)}/>}
            <MemoDialog/>
            <PreviewHost/>
        </>
    );
};

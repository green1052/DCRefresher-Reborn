// 미리보기의 오버레이 호스트. components/overlay/ContentRoot.tsx가 features/*/overlay.tsx를 모아 그린다.
import {Frame} from "./ui/Frame";
import {Mini} from "./ui/Mini";
import {Popups} from "./ui/Popups";

const PreviewHost = () => (
    <>
        <Frame/>
        <Popups/>
        <Mini/>
    </>
);

export default PreviewHost;

import App from "../options/App";

// 팝업 = options 셸의 embedded 렌더. 상태/스타일 전부 공유한다.
export default function PopupApp() {
    return <App embedded/>;
}

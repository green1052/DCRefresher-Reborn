import {createRoot} from "react-dom/client";

import App from "../popup/App";

// 옵션 창은 팝업 UI를 큰 뷰포트에서 보여준다. 셸 코드는 popup/App 하나뿐.
createRoot(document.getElementById("app")!).render(<App page/>);

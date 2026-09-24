import {StrictMode} from "react";
import {createRoot} from "react-dom/client";

import "../popup/popup.scss";
import {App} from "../popup/App";

import "./options.scss";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App optionsPage />
    </StrictMode>
);

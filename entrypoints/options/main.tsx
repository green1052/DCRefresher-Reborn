import {StrictMode} from "react";
import {createRoot} from "react-dom/client";

import "./popup.scss";
import {App} from "./App";

import "./options.scss";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App optionsPage />
    </StrictMode>
);

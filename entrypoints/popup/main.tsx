import "@radix-ui/themes/styles.css";
import "./popup.scss";
import {Theme} from "@radix-ui/themes";
import {StrictMode} from "react";
import {createRoot} from "react-dom/client";

import {App} from "./App";

// Radix Themes는 OS 다크모드를 따라가지 않는다 — 팝업은 잠깐 열리므로 열 때 한 번만 본다
const appearance = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Theme appearance={appearance} accentColor="blue" radius="medium">
            <App/>
        </Theme>
    </StrictMode>
);

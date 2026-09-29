import "@/assets/styles/overlay-radix.css";
import "./popup.scss";
import {Theme} from "@radix-ui/themes";
import {StrictMode} from "react";
import {createRoot} from "react-dom/client";

import {followSystemAppearance} from "@/utils/appearance";

import {App} from "./App";

followSystemAppearance();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Theme accentColor="blue" radius="medium">
            <App/>
        </Theme>
    </StrictMode>
);

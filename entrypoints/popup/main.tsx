import "@/assets/styles/popup.css";
import {StrictMode} from "react";
import {createRoot} from "react-dom/client";

import {setDarkAppearance} from "@/utils/appearance";

import {App} from "./App";

setDarkAppearance(document.documentElement);

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App/>
    </StrictMode>
);

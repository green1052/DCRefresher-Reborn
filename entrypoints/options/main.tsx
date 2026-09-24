import "@radix-ui/themes/styles.css";
import {Theme} from "@radix-ui/themes";
import {StrictMode} from "react";
import {createRoot} from "react-dom/client";

import {App} from "./App";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Theme appearance="inherit" accentColor="blue" radius="medium">
            <App optionsPage />
        </Theme>
    </StrictMode>
);

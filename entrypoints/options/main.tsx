import "@/assets/styles/tailwind.css";
import {StrictMode} from "react";
import {createRoot} from "react-dom/client";

import {TooltipProvider} from "@/components/ui/tooltip";
import {followSystemAppearance} from "@/utils/appearance";

import {App} from "./App";

followSystemAppearance();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <TooltipProvider>
            <App/>
        </TooltipProvider>
    </StrictMode>
);

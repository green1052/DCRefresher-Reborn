import "@/assets/styles/radix-themes.css";
import "@/assets/styles/tailwind.css";
import "@/assets/styles/options.scss";
import {Theme} from "@radix-ui/themes";
import {StrictMode} from "react";
import {createRoot} from "react-dom/client";

import {TooltipProvider} from "@/components/ui/tooltip";
import {followSystemAppearance} from "@/utils/appearance";

import {App} from "./App";

followSystemAppearance();

// Theme은 아직 Radix Themes로 그리는 부품(다이얼로그·설정 칸)을 위해 남겨 둔다.
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Theme accentColor="blue" radius="medium" scaling="110%">
            <TooltipProvider>
                <App/>
            </TooltipProvider>
        </Theme>
    </StrictMode>
);

import "@/assets/styles/radix-themes.css";
import "@/assets/styles/options.scss";
import {Theme} from "@radix-ui/themes";
import {StrictMode, useEffect, useState} from "react";
import {createRoot} from "react-dom/client";

import {App} from "./App";

/** OS 다크모드 여부. Radix Themes는 이를 따라가지 않으므로(inherit은 부모 .dark 클래스만 본다) 직접 감지해 넘긴다 */
const useSystemAppearance = (): "light" | "dark" => {
    const [appearance, setAppearance] = useState<"light" | "dark">(
        () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    );

    useEffect(() => {
        const query = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = (ev: MediaQueryListEvent): void => setAppearance(ev.matches ? "dark" : "light");
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);

    return appearance;
};

const Root = () => {
    const appearance = useSystemAppearance();

    return (
        <StrictMode>
            <Theme appearance={appearance} accentColor="blue" radius="medium" scaling="110%">
                <App/>
            </Theme>
        </StrictMode>
    );
};

createRoot(document.getElementById("root")!).render(<Root/>);

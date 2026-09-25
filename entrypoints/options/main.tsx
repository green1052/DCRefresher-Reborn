import "@radix-ui/themes/styles.css";
import "@/assets/styles/options.scss";
import {Theme} from "@radix-ui/themes";
import {StrictMode, useEffect, useState} from "react";
import {createRoot} from "react-dom/client";

import {App} from "./App";

/** Radix Themes는 OS 다크모드를 따라가지 않는다(inherit은 부모 .dark 클래스만 봄) — 직접 감지해 넘긴다 */
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

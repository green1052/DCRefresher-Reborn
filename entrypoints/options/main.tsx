import "@radix-ui/themes/styles.css";
import {Theme} from "@radix-ui/themes";
import {StrictMode, useEffect, useState} from "react";
import {createRoot} from "react-dom/client";

import {App} from "./App";

/** prefers-color-scheme 실시간 감지 — 확장 페이지엔 color-scheme이 없어 inherit는 동작 안 함 */
const useSystemAppearance = (): "light" | "dark" => {
    const [appearance, setAppearance] = useState<"light" | "dark">(
        () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    );

    useEffect(() => {
        const query = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = (event: MediaQueryListEvent): void => setAppearance(event.matches ? "dark" : "light");
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, []);

    return appearance;
};

const Root = () => {
    const appearance = useSystemAppearance();

    return (
        <StrictMode>
            <Theme appearance={appearance} accentColor="blue" radius="medium">
                <App optionsPage />
            </Theme>
        </StrictMode>
    );
};

createRoot(document.getElementById("root")!).render(<Root />);

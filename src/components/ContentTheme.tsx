import {Theme} from "@radix-ui/themes";
import {useEffect, useState, type ReactNode} from "react";

import "@radix-ui/themes/styles.css";

// 디시 다크모드는 <div id="css-darkmode"> 요소의 존재로 표현된다.
const isDark = () => document.getElementById("css-darkmode") !== null;

// 콘텐츠 스크립트 루트에 Themes 토큰 스코프를 제공한다. 페이지 전역이 아니라
// 각 React 루트에만 .radix-themes 클래스가 생긴다.
export default function ContentTheme({children}: {children: ReactNode}) {
    const [appearance, setAppearance] = useState<"light" | "dark">(isDark() ? "dark" : "light");

    useEffect(() => {
        const observer = new MutationObserver(() => setAppearance(isDark() ? "dark" : "light"));
        observer.observe(document.documentElement, {childList: true, subtree: true});
        return () => observer.disconnect();
    }, []);

    return (
        <Theme appearance={appearance} grayColor="slate" radius="medium">
            {children}
        </Theme>
    );
}

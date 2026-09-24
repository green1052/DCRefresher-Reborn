import {useModulesStore} from "@/stores/modules";

const LINKS: [string, string][] = [
    ["GitHub", "https://github.com/green1052/DCRefresher-Reborn"],
    ["갤러리", "https://gall.dcinside.com/mini/board/lists/?id=bjwg64"],
    ["Discord", "https://discord.gg/SSW6Zuyjz6"],
    ["후원", "https://www.buymeacoffee.com/green1052"],
    ["도움말", "https://dcrefresher.green1052.com"]
];

export function GeneralTab() {
    const unavailable = useModulesStore((state) => state.unavailable);

    return (
        <div>
            <div className="refresher-module-row">
                <div className="refresher-module-text">
                    <div className="refresher-module-name">DCRefresher Reborn</div>
                    <div className="refresher-module-desc">
                        {browser.runtime.getManifest().version}
                        {LINKS.map(([text, url]) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer">
                                {text}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
            {unavailable && <div className="empty">우선 디시인사이드 페이지를 열고 설정해주세요.</div>}
        </div>
    );
}

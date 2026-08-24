import iconUrl from "@/assets/icon.png";

import SettingsModule from "../components/settingsModule";
import {useAppContext} from "../context";

const links = [
    {text: "GitHub", url: "https://github.com/green1052/DCRefresher-Reborn"},
    {text: "갤러리", url: "https://gall.dcinside.com/mini/board/lists/?id=bjwg64"},
    {text: "Discord", url: "https://discord.gg/SSW6Zuyjz6"},
    {text: "후원", url: "https://www.buymeacoffee.com/green1052"},
    {text: "도움말", url: "https://dcrefresher.green1052.com"}
];

export default function GeneralTab() {
    const {settings} = useAppContext();
    const {modules, settings: moduleSettings, hasSettings, modulesWithBasicSettings} = settings;

    const version = import.meta.env.DEV
        ? `${browser.runtime.getManifest().version}-dev`
        : browser.runtime.getManifest().version;

    const open = (url: string) => {
        browser.tabs.create({url});
    };

    return (
        <div className="tab tab0">
            <div className="info">
                <div className="icon-wrap">
                    <img
                        className="icon"
                        src={iconUrl}
                    />
                </div>

                <div className="text">
                    <h3>DCRefresher Reborn</h3>
                    <p>
                        <span className="version">{version}</span>
                        {links.map((link) => (
                            <a
                                key={link.url}
                                onClick={() => open(link.url)}
                            >
                                {link.text}
                            </a>
                        ))}
                    </p>
                </div>
            </div>

            <div className="settings">
                {!hasSettings ? (
                    <div>
                        <h3 className="need-refresh">우선 디시인사이드 페이지를 열고 설정 해주세요.</h3>
                    </div>
                ) : (
                    <div>
                        {modulesWithBasicSettings.map((moduleName) => (
                            <SettingsModule
                                key={moduleName}
                                moduleEnabled={modules[moduleName]?.enable ?? false}
                                moduleName={moduleName}
                                moduleSettings={moduleSettings[moduleName] ?? {}}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

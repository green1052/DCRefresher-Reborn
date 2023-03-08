import React, { useCallback, useEffect, useState } from "react";
import browser from "webextension-polyfill";
import {
    BLOCK_DETECT_MODE_TYPE_NAMES,
    BlockModeCache,
    TYPE_NAMES
} from "../core/block";
import storage from "../utils/storage";
import { TYPE_NAMES as MEMO_TYPE_NAMES } from "../core/memo";

interface ITab {
    name: string;
    id: number;
}

interface ILink {
    text: string;
    url: string;
}

type IModule = Record<string, RefresherModule>;

type ISetting = Record<string, Record<string, RefresherSettings>>;

type IBlock = Record<RefresherBlockType, RefresherBlockValue[]>;

type IMemo = Record<RefresherMemoType, Record<string, RefresherMemoValue>>;

const port = browser.runtime.connect({ name: "refresherInternal" });

function Refresher() {
    const [activeTab, setActiveTab] = useState<number>(0);

    const [modules, setModules] = useState<IModule>({});
    const [settings, setSettings] = useState<ISetting>({});

    useEffect(() => {
        port.postMessage({
            requestRefresherModules: true,
            requestRefresherSettings: true,
            requestRefresherBlocks: true,
            requestRefresherMemos: true
        });

        port.onMessage.addListener((message) => {
            if (message.responseRefresherModules) {
                setModules(message.modules);
            }

            if (message.responseRefresherSettings) {
                setSettings(message.settings);
            }
        });
    }, []);

    const tabs: ITab[] = [
        { name: "일반", id: 0 },
        { name: "고급", id: 1 },
        { name: "차단", id: 2 },
        { name: "메모", id: 3 },
        { name: "자짤", id: 4 },
        { name: "모듈", id: 5 },
        { name: "단축키", id: 6 }
    ];

    const TabList: Record<number, JSX.Element> = {
        0: (
            <RefresherGeneralTab
                modules={modules}
                settings={settings}
            />
        ),
        1: <RefresherAdvancedTab />,
        2: <RefresherBlockTab />,
        3: <RefresherMemoTab />,
        4: <RefresherSelfImageTab />,
        5: <RefresherModuleTab modules={modules} />,
        6: <RefresherShortcutTab />
    };

    return (
        <div id="refresher-app">
            <div className="refresher-add-block-popup" />

            <div className="refresher-title-zone">
                <h1>설정</h1>
                <div className="float-right">
                    {tabs.map((tab: ITab) => {
                        return (
                            <p
                                key={tab.id}
                                className={activeTab === tab.id ? "active" : ""}
                                onClick={() => setActiveTab(tab.id)}>
                                {tab.name}
                            </p>
                        );
                    })}
                </div>
            </div>

            {TabList[activeTab]}
        </div>
    );
}

function RefresherGeneralTab({
    modules,
    settings
}: {
    modules: IModule;
    settings: ISetting;
}) {
    const getURL = useCallback((url: string) => {
        return browser.runtime.getURL(url);
    }, []);

    const getVersion = useCallback(() => {
        return browser.runtime.getManifest().version;
    }, []);

    const warpType = useCallback((value: unknown) => {
        if (typeof value === "boolean") {
            return value ? "On" : "Off";
        }

        return value;
    }, []);

    const links: ILink[] = [
        {
            text: "GitHub",
            url: "https://github.com/green1052/DCRefresher-Reborn"
        },
        {
            text: "Discord",
            url: "https://discord.gg/SSW6Zuyjz6"
        },
        {
            text: "Chrome Web Store",
            url: "https://chrome.google.com/webstore/detail/dcrefresher-reborn/pmfifcbendahnkeojgpfppklgioemgon"
        },
        {
            text: "Firefox Add-ons",
            url: "https://addons.mozilla.org/ko/firefox/addon/dcrefresher-reborn"
        }
    ];

    return (
        <div
            key="tab0"
            className="tab tab0">
            <div className="info">
                <div className="icon-wrap">
                    <img
                        alt="Logo"
                        src={getURL("/assets/icons/logo/Icon.png")}
                        className="icon"
                    />
                </div>

                <div className="text">
                    <h3>DCRefresher Reborn</h3>
                    <p>
                        <span className="version">{getVersion()}</span>

                        {links.map((link) => {
                            return (
                                <a
                                    key={link.url}
                                    onClick={() => window.open(link.url)}>
                                    {link.text}
                                </a>
                            );
                        })}
                    </p>
                </div>
            </div>

            <div className="settings">
                {Object.keys(modules).map((module) => {
                    const moduleSettings = settings[module];

                    if (typeof moduleSettings !== "object") return;

                    return (
                        <div className="refresher-setting-category">
                            <h3>
                                {module}

                                <svg
                                    fill="black"
                                    height="18px"
                                    viewBox="0 0 24 24"
                                    width="18px"
                                    xmlns="http://www.w3.org/2000/svg">
                                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                                </svg>
                            </h3>

                            {Object.values(moduleSettings)
                                .filter((setting) => !setting.advanced)
                                .map((setting) => {
                                    return (
                                        <div
                                            className="refresher-setting"
                                            data-changed={
                                                setting.value !==
                                                setting.default
                                            }>
                                            <div className="info">
                                                <h4>{setting.name}</h4>
                                                <p>{setting.desc}</p>
                                                <p className="mute">
                                                    (기본 값:{" "}
                                                    {warpType(setting.default)})
                                                </p>
                                            </div>

                                            <div className="control"></div>
                                        </div>
                                    );
                                })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function RefresherAdvancedTab() {
    return <h2>TODO</h2>;
}

function RefresherBlockTab() {
    const [blocks, setBlocks] = useState<IBlock>({
        NICK: [],
        ID: [],
        IP: [],
        TITLE: [],
        TEXT: [],
        COMMENT: [],
        DCCON: []
    });

    const [blockModes, setBlockModes] = useState<BlockModeCache>({
        NICK: "SAME",
        ID: "SAME",
        IP: "SAME",
        TITLE: "CONTAIN",
        TEXT: "CONTAIN",
        COMMENT: "CONTAIN",
        DCCON: "SAME"
    });

    useEffect(() => {
        port.postMessage({
            requestRefresherBlocks: true
        });

        port.onMessage.addListener((message) => {
            if (message.responseRefresherBlocks) {
                setBlocks(message.blocks);
                setBlockModes(message.blockModes);
            }
        });
    }, []);

    return (
        <div className="tab tab2">
            <div style={{ marginBottom: "10px" }}>
                <h2>차단 모드</h2>

                {Object.keys(blocks).map((key) => {
                    return (
                        <div style={{ marginTop: "5px", marginBottom: "5px" }}>
                            <label>{TYPE_NAMES[key]}:&nbsp;</label>
                            <select>
                                {Object.entries(
                                    BLOCK_DETECT_MODE_TYPE_NAMES
                                ).map(([key2, value2]) => {
                                    console.log(key2, value2);
                                    return (
                                        <option value={key2}>{value2}</option>
                                    );
                                })}
                            </select>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function RefresherMemoTab() {
    const [memos, setMemos] = useState<IMemo>({ UID: {}, NICK: {}, IP: {} });

    useEffect(() => {
        port.postMessage({
            requestRefresherMemos: true
        });

        port.onMessage.addListener((message) => {
            if (message.requestRefresherMemos) setMemos(message.memos);
        });
    }, []);

    const addMemo = useCallback((type: RefresherMemoType) => {
        const user = prompt("메모 대상을 입력하세요.");

        if (!user) return;

        browser.tabs
            .query({ active: true, currentWindow: true })
            .then((tabs) => {
                browser.tabs.sendMessage(tabs[0].id!, {
                    type: "refresherRequestMemoAsk",
                    data: {
                        type,
                        user
                    }
                });
            });
    }, []);

    const editMemo = useCallback((type: RefresherMemoType, user: string) => {
        browser.tabs
            .query({ active: true, currentWindow: true })
            .then((tabs) => {
                browser.tabs.sendMessage(tabs[0].id!, {
                    type: "refresherRequestMemoAsk",
                    data: {
                        type,
                        user
                    }
                });
            });
    }, []);

    const removeMemo = useCallback(
        (type: RefresherMemoType, user: string) => {
            const obj = { ...memos };
            delete obj[type][user];
            setMemos(obj);

            saveMemo();
        },
        [memos]
    );

    const saveMemo = useCallback(() => {
        port.postMessage({
            updateMemos: true,
            memos_store: memos
        });

        browser.tabs.query({ active: true }).then((tabs) => {
            browser.tabs.sendMessage(tabs[0].id!, {
                type: "updateMemos",
                data: {
                    memos
                }
            });
        });
    }, [memos]);

    return (
        <div className="tab tab3">
            {Object.keys(memos).map((key) => {
                const name = MEMO_TYPE_NAMES[key];
                const memo = memos[key];
                const memoLength = Object.keys(memo).length;

                return (
                    <div className="block-divide">
                        <h3>
                            {name} ({memoLength})
                            <span
                                onClick={() => addMemo(key)}
                                className="plus">
                                <svg
                                    fill="black"
                                    height="18px"
                                    viewBox="0 0 24 24"
                                    width="18px"
                                    xmlns="http://www.w3.org/2000/svg">
                                    <path
                                        d="M0 0h24v24H0z"
                                        fill="none"
                                    />
                                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                                </svg>
                            </span>
                        </h3>

                        <div className="lists">
                            {!memoLength ? (
                                <p>{name} 메모 없음</p>
                            ) : (
                                Object.entries(memo).map(([user, memo]) => {
                                    return (
                                        <RefresherBubble
                                            key={user}
                                            text={`${user} (${memo.text.substring(
                                                0,
                                                10
                                            )})`}
                                            onTextClick={() =>
                                                editMemo(key, user)
                                            }
                                            onRemoveClick={() =>
                                                removeMemo(key, user)
                                            }
                                        />
                                    );
                                })
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function RefresherSelfImageTab() {
    return (
        <div className="tab tab4">
            <img
                style={{ width: "100px", height: "100px" }}
                src="https://pbs.twimg.com/media/E_AGBpdUcAQzadz?format=jpg"
            />

            <h1>자짤 기능인줄 알았지? ㅋㅋㅋ "캬루" 지롱</h1>
        </div>
    );
}

function RefresherModuleTab({ modules }: { modules: IModule }) {
    return (
        <div className="tab tab5">
            {Object.values(modules).map((module) => {
                return (
                    <RefresherModule
                        name={module.name}
                        description={module.description}
                        requirement={module.require}
                        enable={module.enable}
                    />
                );
            })}
        </div>
    );
}

function RefresherShortcutTab() {
    const [shortcut, setShortcut] = useState<browser.Commands.Command[]>([]);

    useEffect(() => {
        browser.commands.getAll().then(setShortcut);
    }, []);

    return (
        <div
            key="tab6"
            className="tab tab6">
            <div className="shortcut-lists">
                {shortcut.map((command) => {
                    if (!command.description) return null;

                    return (
                        <div className="refresher-shortcut">
                            <p className="description">{command.description}</p>
                            <div className="key">
                                <RefresherBubble
                                    text={command.shortcut || "키 없음"}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            <p>
                <a onClick={() => browser.runtime.openOptionsPage()}>
                    단축키 설정
                </a>
            </p>
        </div>
    );
}

function RefresherBubble({
    text,
    image,
    gallery,
    extra,
    onRemoveClick,
    onTextClick
}: {
    text?: string;
    image?: string;
    gallery?: boolean;
    extra?: string;
    onRemoveClick?: () => void;
    onTextClick?: () => void;
}) {
    const clickEvent = useCallback(() => {
        onTextClick?.();
    }, []);

    const removeEvent = useCallback(() => {
        onRemoveClick?.();
    }, []);

    return (
        <div className="refresher-bubble">
            <span
                className="text"
                onClick={clickEvent}>
                {image && (
                    <img
                        alt=""
                        src={image}
                    />
                )}
                {text} {extra ? `(${extra})` : ""}
                {gallery && <span className="gallery">{gallery}</span>}
            </span>

            {onRemoveClick && (
                <span
                    className="remove"
                    onClick={removeEvent}>
                    <svg
                        height="14"
                        viewBox="0 0 18 18"
                        width="14"
                        xmlns="http://www.w3.org/2000/svg">
                        <path d="M14.53 4.53l-1.06-1.06L9 7.94 4.53 3.47 3.47 4.53 7.94 9l-4.47 4.47 1.06 1.06L9 10.06l4.47 4.47 1.06-1.06L10.06 9z" />
                    </svg>
                </span>
            )}
        </div>
    );
}

function RefresherModule({
    name,
    description,
    requirement,
    enable
}: {
    name: string;
    description: string;
    requirement?: string[];
    enable: boolean;
}) {
    const update = useCallback(
        (moduleName?: string, id?: string, checked?: boolean) => {
            storage.set<boolean>(name, checked ?? false);

            browser.tabs.query({ active: true }).then((tabs) => {
                for (const v of tabs) {
                    browser.tabs.sendMessage(v.id!, {
                        type: "updateModuleStatus",
                        data: {
                            name,
                            value: checked
                        }
                    });
                }
            });
        },
        []
    );

    return (
        <div className="refresher-module">
            <div className="left">
                <p className="title">{name}</p>
                <p className="desc">{description}</p>
                <p className="mute">
                    요규 유틸: {requirement?.join(", ") || "없음"}
                </p>
            </div>
            <div className="right">
                <RefresherCheckBox
                    onChange={update}
                    checked={enable}
                />
            </div>
        </div>
    );
}

function RefresherCheckBox({
    onChange,
    moduleName,
    id,
    checked,
    disabled
}: {
    onChange?: (moduleName?: string, id?: string, checked?: boolean) => void;
    moduleName?: string;
    id?: string;
    checked?: boolean;
    disabled?: boolean;
}) {
    const [checkState, setCheckState] = useState<boolean>(checked ?? false);
    const [onceOut, setOnceOut] = useState<boolean>(false);
    const [down, setDown] = useState<boolean>(false);
    const [translateX, setTranslateX] = useState<number | undefined>(undefined);

    const clickEvent = useCallback(() => {
        if (disabled) return;

        if (onceOut) {
            setOnceOut(false);
            return;
        }

        const invert = !checkState;

        setCheckState(invert);
        onChange?.(moduleName, id, invert);
    }, [onceOut, checkState]);

    const upEvent = useCallback(() => {
        if (disabled) return;
        setDown(false);
        setTranslateX(undefined);
    }, [setDown, setTranslateX]);

    const downEvent = useCallback(() => {
        if (!disabled) setDown(true);
    }, []);

    const moveEvent = useCallback(
        (ev: React.PointerEventHandler<HTMLDivElement>) => {
            if (disabled) return;

            if (down) setTranslateX(Math.ceil(ev.nativeEvent.offsetX));
        },
        [down]
    );

    const outEvent = useCallback(() => {
        if (disabled || !down) return;
        setDown(false);
        setTranslateX(undefined);
        clickEvent();
        setOnceOut(true);
    }, [down]);

    return (
        <div
            className={
                disabled ? "refresher-checkbox disabled" : "refresher-checkbox"
            }
            data-id={id}
            data-module={moduleName}
            data-on={checkState}
            onClick={clickEvent}>
            <div
                style={{
                    transform: `translateX(${
                        translateX ?? checkState ? 18 : 0
                    }px)`
                }}
                className="selected"
                onPointerUp={upEvent}
                onPointerDown={downEvent}
                onPointerMove={moveEvent}
                onPointerOut={outEvent}
            />
        </div>
    );
}

export default Refresher;

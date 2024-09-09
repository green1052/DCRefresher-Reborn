import React, {ChangeEvent, useCallback, useEffect, useState} from "react";
import browser from "webextension-polyfill";
import * as storage from "../utils/storage";
import {BLOCK_DETECT_MODE_TYPE_NAMES, BlockModeCache, TYPE_NAMES as BLOCK_TYPE_NAMES} from "../core/block";
import {Checkbox} from "./Checkbox";
import {Options} from "./Options";
import {Range} from "./Range";
import {Input} from "./Input";
import {Bubble} from "./Bubble";

const port = browser.runtime.connect({name: "refresherInternal"});

const tabList = [
    "일반",
    "고급",
    "차단",
    "메모",
    "자짤",
    "모듈",
    "단축키"
];

const linkList = [
    {
        text: "GitHub",
        url: "https://github.com/green1052/DCRefresher-Reborn"
    },
    {
        text: "Discord",
        url: "https://discord.gg/SSW6Zuyjz6"
    },
    {
        text: "후원",
        url: "https://www.buymeacoffee.com/green1052"
    }
];

function NeedRefresh() {
    return (
        <div>
            <h3 className="need-refresh">
                우선 디시인사이드 페이지를 열고 설정 해주세요.
            </h3>
        </div>
    );
}

function Tab({children, id}: { children: React.ReactNode, id: number }) {
    return (
        <div className={`tab tab${id}`} key={`tab${id}`}>
            {children}
        </div>
    );
}

function Tab1({updateSetting, modules, settings}: {
    updateSetting: (module: string, key: string, value: unknown) => void,
    modules: Record<string, RefresherModule>,
    settings: Record<string, Record<string, RefresherSettings>>
}) {
    const [databaseVersion, setDatabaseVersion] = useState<string | null>(null);

    useEffect(() => {
        storage.get<string>("databaseVersion").then(setDatabaseVersion);
    }, []);

    return (
        <Tab id={1}>
            <div className="info">
                <div className="icon-wrap">
                    <img className="icon" src={browser.runtime.getURL("/assets/icons/logo/Icon.png")}/>
                </div>

                <div className="text">
                    <h3>DCRefresher Reborn</h3>

                    <p>
                        <span className="version">
                            {browser.runtime.getManifest().version_name ?? browser.runtime.getManifest().version}
                        </span>

                        {
                            linkList.map((link) => (
                                <a onClick={() => browser.tabs.create({url: link.url})}>{link.text}</a>
                            ))
                        }
                    </p>

                    <p>
                        <span className="version">
                            데이터베이스 버전: {databaseVersion || "미설치"}

                            <svg
                                height="12px"
                                style={{cursor: "pointer"}}
                                viewBox="0 0 30 30"
                                width="12px"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M 15 3 C 12.031398 3 9.3028202 4.0834384 7.2070312 5.875 A 1.0001 1.0001 0 1 0 8.5058594 7.3945312 C 10.25407 5.9000929 12.516602 5 15 5 C 20.19656 5 24.450989 8.9379267 24.951172 14 L 22 14 L 26 20 L 30 14 L 26.949219 14 C 26.437925 7.8516588 21.277839 3 15 3 z M 4 10 L 0 16 L 3.0507812 16 C 3.562075 22.148341 8.7221607 27 15 27 C 17.968602 27 20.69718 25.916562 22.792969 24.125 A 1.0001 1.0001 0 1 0 21.494141 22.605469 C 19.74593 24.099907 17.483398 25 15 25 C 9.80344 25 5.5490109 21.062074 5.0488281 16 L 8 16 L 4 10 z"/>
                            </svg>
                        </span>
                    </p>
                </div>
            </div>

            <Settings updateSetting={updateSetting} modules={modules} settings={settings} advanced={false}/>
        </Tab>
    );
}

function Tab2({updateSetting, modules, settings}: {
    updateSetting: (module: string, key: string, value: unknown) => void,
    modules: Record<string, RefresherModule>,
    settings: Record<string, Record<string, RefresherSettings>>
}) {

    return (
        <Tab id={2}>
            <Settings updateSetting={updateSetting} modules={modules} settings={settings} advanced={true}/>
        </Tab>
    );
}

function Tab3({blocks, updateBlock, blockModes, updateBlockMode}: {
    blocks: Record<RefresherBlockType, RefresherBlockValue[]>
    updateBlock: (key: RefresherBlockType, value: RefresherBlockValue[]) => void,
    blockModes: BlockModeCache,
    updateBlockMode: (key: RefresherBlockType, value: RefresherBlockDetectMode) => void
}) {
    const onChange = useCallback((ev: ChangeEvent<HTMLSelectElement>) => {
        // updateBlockMode`(ev.target., ev.target.value);
    }, []);

    const exportBlock = useCallback(() => {
        navigator.clipboard.writeText(JSON.stringify(blocks, null, 4))
            .then(() => {
                alert("클립보드에 복사되었습니다.");
            })
            .catch(() => {
                alert("클립보드에 복사하지 못했습니다.");
            });
    }, []);

    const importBlock = useCallback(() => {
        const result = prompt("가져올 데이터를 입력하세요.");

        if (!result) return;

        const deepCopy = {...blocks};

        try {
            const data = JSON.parse(result);

            for (const [key, value] of Object.entries(data)) {
                const target = deepCopy[key as RefresherBlockType];

                for (const block of value as RefresherBlockValue[]) {
                    if (target.some((v) => v.content === block.content) && !confirm(`${block.content}가 이미 존재합니다, 덮어쓰시겠습니까?`)) {
                        continue;
                    }

                    target.push(block);
                }
            }

            alert("가져오기에 성공했습니다.");
        } catch (e) {
            alert("데이터가 잘못됐습니다.");
        }
    }, []);

    const removeBlockedUser = useCallback((key: RefresherBlockType, index: number) => {
        const deepCopy = {...blocks};
        deepCopy[key].splice(index, 1);
        updateBlock(key, deepCopy[key]);
    }, []);

    const addEmptyBlockedUser = useCallback((key: RefresherBlockType) => {

    }, []);

    const removeAllBlockedUser = useCallback((key: RefresherBlockType) => {
        // if (!confirm("ㄹ?ㅇ")) return;
        // updateBlock(key, []);
    }, []);

    const editBlockedUser = useCallback((key: RefresherBlockType, index: number) => {
        if (key === "DCCON") {
            alert("디시콘 수정은 아직 지원하지 않습니다, 우클릭 메뉴를 이용해주세요.");
            return;
        }

        const result = prompt(`바꿀 ${BLOCK_TYPE_NAMES[key]} 값을 입력하세요.`);

        if (!result) return;

        const deepCopy = {...blocks};
        deepCopy[key][index].content = result;
        updateBlock(key, deepCopy[key]);
    }, []);

    return (
        <Tab id={3}>
            <div style={{marginBottom: "15px"}}>
                <div style={{marginTop: "5px", float: "left"}}>
                    <button onClick={exportBlock}>내보내기</button>
                    <button onClick={importBlock}>가져오기</button>
                </div>

                <br/>
                <br/>

                <h2>차단 모드</h2>

                {
                    Object.keys(blocks).map((key) => (
                        <div style={{marginTop: "5px", marginBottom: "5px"}}>
                            <label>{BLOCK_TYPE_NAMES[key as RefresherBlockType]}</label>
                            <select onChange={onChange} defaultValue={blockModes[key as RefresherBlockType]}>
                                {
                                    Object.entries(BLOCK_DETECT_MODE_TYPE_NAMES).map(([key2, value2]) => (
                                        <option value={key2}>
                                            {value2}
                                        </option>
                                    ))
                                }
                            </select>
                        </div>
                    ))
                }
            </div>

            {
                Object.keys(blocks).map((key) => (
                    <div className="block-divide">
                        <h3>
                            {BLOCK_TYPE_NAMES[key]} ({blocks[key].length}개)

                            <span className="plus" onClick={() => addEmptyBlockedUser(key)}>
                                <svg
                                    fill="black"
                                    height="18px"
                                    viewBox="0 0 24 24"
                                    width="18px"
                                    xmlns="http://www.w3.org/2000/svg">
                                    <path
                                        d="M0 0h24v24H0z"
                                        fill="none"/>
                                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                                </svg>
                        </span>
                            <span className="remove" onClick={() => removeAllBlockedUser(key)}>
                            <svg
                                height="14"
                                viewBox="0 0 18 18"
                                width="14"
                                xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M14.53 4.53l-1.06-1.06L9 7.94 4.53 3.47 3.47 4.53 7.94 9l-4.47 4.47 1.06 1.06L9 10.06l4.47 4.47 1.06-1.06L10.06 9z"/>
                            </svg>
                        </span>
                        </h3>

                        <div className="lists">
                            {blocks[key as RefresherBlockType].length === 0 && <p>차단된 {BLOCK_TYPE_NAMES[key]} 없음</p>}

                            {
                                blocks[key as RefresherBlockType].map((block, index) => (
                                    <Bubble
                                        key={index}
                                        text={block.content}
                                        image={key === "DCCON" ? `https://image.dcinside.com/dccon.php?no=${block.isRegex ? block.content.match(/^\^\((\w*)\|/)?.[1] : block.content}` : undefined}
                                        isRegex={block.isRegex}
                                        gallery={block.gallery}
                                        extra={block.extra}
                                        onRemove={() => removeBlockedUser(key as RefresherBlockType, index)}
                                        onTextClick={() => editBlockedUser(key as RefresherBlockType, index)}
                                    />
                                ))
                            }
                        </div>
                    </div>
                ))
            }
        </Tab>
    );
}

function Settings({updateSetting, modules, settings, advanced}: {
    updateSetting: (module: string, key: string, value: unknown) => void,
    modules: Record<string, RefresherModule>,
    settings: Record<string, Record<string, RefresherSettings>>,
    advanced: boolean
}) {
    return (
        <div className="settings">
            {
                !Object.keys(settings).length
                    ? <NeedRefresh/>
                    : Object.keys(settings)
                        .filter((module) => modules[module].enable && (advanced && Object.values(settings[module]).filter((v) => v?.advanced).length) || !advanced)
                        .map((module) => (
                            <SettingsCategory key={module} updateSetting={updateSetting} module={module}
                                              settings={settings[module]}
                                              advanced={advanced}/>
                        ))
            }
        </div>
    );
}

function SettingsCategory({updateSetting, module, settings, advanced}: {
    updateSetting: (module: string, key: string, value: unknown) => void,
    module: string,
    settings: Record<string, RefresherSettings>,
    advanced: boolean
}) {
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
                    <path
                        d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
            </h3>

            {
                Object.keys(settings).map((setting) => (
                    <SettingsItem
                        key={setting}
                        updateSetting={updateSetting}
                        module={module}
                        settingKey={setting}
                        setting={settings[setting]}
                        advanced={advanced}
                    />
                ))
            }
        </div>
    );
}

function SettingsItem({updateSetting, module, settingKey, setting, advanced}: {
    updateSetting: (module: string, key: string, value: unknown) => void,
    module: string,
    settingKey: string,
    setting: RefresherSettings,
    advanced: boolean
}) {
    const typeWrap = useCallback((value: string | number | boolean) => {
        if (typeof value === "boolean") {
            return value ? "On" : "Off";
        }

        if (typeof value === "string" && value === "") {
            return "없음";
        }

        return value;
    }, []);

    return (
        <div
            className="refresher-setting"
            data-changed={setting.default !== setting.value}
        >
            <div className="info">
                <h4>{setting.name}</h4>
                <p>{setting.desc}</p>
                <p className="mute">
                    (기본 값: {typeWrap(setting.default)})
                </p>
            </div>

            <div className="control">
                {
                    setting.type === "check" &&
                    <Checkbox
                        onChange={updateSetting}
                        module={module}
                        id={settingKey}
                        checked={setting.value}
                        disabled={false}
                    />
                }
                {
                    setting.type === "text" &&
                    <Input
                        onChange={updateSetting}
                        placeholder={setting.default}
                        module={module}
                        id={settingKey}
                        value={setting.value}
                        disabled={false}
                    />
                }
                {
                    setting.type === "range" &&
                    <Range
                        onChange={updateSetting}
                        module={module}
                        id={settingKey}
                        placeholder={String(setting.default)}
                        value={setting.value}
                        max={setting.max}
                        min={setting.min}
                        step={setting.step}
                        unit={setting.unit}
                        disabled={false}
                    />
                }
                {
                    setting.type === "option" &&
                    <Options
                        onChange={updateSetting}
                        module={module}
                        id={settingKey}
                        options={setting.items as Record<string, string>}
                        value={setting.value}
                        disabled={false}
                    />
                }
            </div>
        </div>
    );
}

export function App() {
    const [currentTab, setCurrentTab] = useState(0);

    const [modules, setModules] = useState<Record<string, RefresherModule> | null>(null);
    const [settings, setSettings] = useState<Record<string, Record<string, RefresherSettings>> | null>(null);
    const [blocks, setBlocks] = useState<Record<RefresherBlockType, RefresherBlockValue[]> | null>(null);
    const [blockModes, setBlockModes] = useState<BlockModeCache | null>(null);
    const [memos, setMemos] = useState<Record<RefresherMemoType, Record<string, RefresherMemoValue>> | null>(null);

    const updateSetting = useCallback((module: string, key: string, value: unknown) => {
        const deepCopy = {...settings};
        // @ts-ignore
        deepCopy[module][key].value = value;
        setSettings(deepCopy);

        port.postMessage({
            updateUserSetting: true,
            name: module,
            key,
            value,
            settings_store: deepCopy
        });

        browser.tabs.query({active: true}).then((tabs) => {
            browser.tabs.sendMessage(tabs[0].id!, {
                type: "updateSettingValue",
                data: {
                    name: module,
                    key,
                    value
                }
            });
        });
    }, [settings]);

    const updateBlock = useCallback((key: RefresherBlockType, value: RefresherBlockValue[]) => {
        const deepCopy = {...blocks};
        deepCopy[key] = value;
        setBlocks(deepCopy as Record<RefresherBlockType, RefresherBlockValue[]> | null);

        port.postMessage({
            updateBlocks: true,
            blocks_store: blocks,
            blockModes_store: blockModes
        });

        browser.tabs.query({active: true}).then((tabs) => {
            browser.tabs.sendMessage(tabs[0].id!, {
                type: "updateBlocks",
                data: {
                    blocks: blocks,
                    modes: blockModes
                }
            });
        });
    }, [blocks, blockModes]);

    const updateBlockMode = useCallback((key: RefresherBlockType, value: RefresherBlockDetectMode) => {
        const deepCopy = {...blockModes};
        deepCopy[key] = value;
        setBlockModes(deepCopy as BlockModeCache | null);

        port.postMessage({
            updateBlocks: true,
            blocks_store: blocks,
            blockModes_store: blockModes
        });

        browser.tabs.query({active: true}).then((tabs) => {
            browser.tabs.sendMessage(tabs[0].id!, {
                type: "updateBlocks",
                data: {
                    blocks: blocks,
                    modes: blockModes
                }
            });
        });
    }, []);

    useEffect(() => {
        port.postMessage({
            requestRefresherModules: true,
            requestRefresherSettings: true,
            requestRefresherBlocks: true,
            requestRefresherMemos: true
        });

        port.onMessage.addListener((message: any) => {
            if (message.responseRefresherModules && message.modules) {
                setModules(message.modules);
            }

            if (message.responseRefresherSettings && message.settings) {
                setSettings(message.settings);
            }

            if (message.responseRefresherBlocks && message.blocks && message.blockModes) {
                setBlocks(message.blocks);
                setBlockModes(message.blockModes);
            }

            if (message.requestRefresherMemos && message.memos) {
                setMemos(message.memos);
            }
        });
    }, []);

    return (
        <div id="refresher-app">
            <div className="refresher-title-zone">
                <h1>설정</h1>
                <div className="float-right">
                    {
                        tabList.map((tab, index) => (
                            <p
                                className={currentTab === index ? "active" : ""}
                                onClick={() => setCurrentTab(index)}>
                                {tab}
                            </p>
                        ))
                    }
                </div>
            </div>

            {
                modules && settings && blocks && blockModes && memos &&
                (
                    currentTab === 0 && <Tab1 updateSetting={updateSetting} modules={modules} settings={settings}/> ||
                    currentTab === 1 && <Tab2 updateSetting={updateSetting} modules={modules} settings={settings}/> ||
                    currentTab === 2 &&
                    <Tab3 blocks={blocks} updateBlock={updateBlock} blockModes={blockModes}
                          updateBlockMode={updateBlockMode}/>
                )
            }
        </div>
    );
}
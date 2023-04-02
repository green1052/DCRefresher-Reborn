<template>
    <div id="refresher-app">
        <div class="refresher-add-block-popup" />
        <div class="refresher-title-zone">
            <h1>설정</h1>
            <div class="float-right">
                <p
                    :class="{ active: tab === 0 }"
                    @click="() => (tab = 0)">
                    일반
                </p>
                <p
                    :class="{ active: tab === 1 }"
                    @click="() => (tab = 1)">
                    고급
                </p>
                <p
                    :class="{ active: tab === 2 }"
                    @click="() => (tab = 2)">
                    차단
                </p>
                <p
                    :class="{ active: tab === 3 }"
                    @click="() => (tab = 3)">
                    메모
                </p>
                <p
                    :class="{ active: tab === 4 }"
                    @click="() => (tab = 4)">
                    자짤
                </p>
                <p
                    :class="{ active: tab === 5 }"
                    @click="() => (tab = 5)">
                    모듈
                </p>
                <p
                    :class="{ active: tab === 6 }"
                    @click="() => (tab = 6)">
                    단축키
                </p>
            </div>
        </div>
        <transition-group
            mode="in-out"
            name="refresher-slide-left">
            <div
                v-show="tab === 0"
                key="tab1"
                class="tab tab1">
                <div class="info">
                    <div class="icon-wrap">
                        <img
                            :src="getURL('/assets/icons/logo/Icon.png')"
                            class="icon" />
                        <img
                            :src="getURL('/assets/icons/logo/Icon.png')"
                            class="icon-backdrop" />
                    </div>
                    <div class="text">
                        <h3>DCRefresher Reborn</h3>
                        <p>
                            <span class="version">{{ getVersion() }}</span>
                            <a
                                v-for="link in links"
                                @click="open(link.url)"
                                >{{ link.text }}</a
                            >
                        </p>
                    </div>
                </div>

                <div class="settings">
                    <div v-if="!Object.keys(settings).length">
                        <h3 class="need-refresh">
                            우선 디시인사이드 페이지를 열고 설정 해주세요.
                        </h3>
                    </div>

                    <div
                        v-for="module in Object.keys(settings)"
                        v-else
                        class="refresher-setting-category">
                        <h3 @click="moveToModuleTab(module)">
                            {{ module }}
                            <svg
                                fill="black"
                                height="18px"
                                viewBox="0 0 24 24"
                                width="18px"
                                xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                            </svg>
                        </h3>

                        <div
                            v-for="setting in Object.keys(settings[module])"
                            v-if="!settings[module][setting].advanced"
                            :data-changed="
                                settings[module][setting].value !==
                                settings[module][setting].default
                            "
                            class="refresher-setting">
                            <div class="info">
                                <h4>{{ settings[module][setting].name }}</h4>
                                <p>{{ settings[module][setting].desc }}</p>
                                <p class="mute">
                                    (기본 값 :
                                    {{
                                        typeWrap(
                                            settings[module][setting].default
                                        )
                                    }})
                                </p>
                            </div>

                            <div class="control">
                                <refresher-checkbox
                                    v-if="
                                        settings[module][setting].type ===
                                        'check'
                                    "
                                    :id="setting"
                                    :change="updateUserSetting"
                                    :checked="settings[module][setting].value"
                                    :modname="module" />
                                <refresher-input
                                    v-else-if="
                                        settings[module][setting].type ===
                                        'text'
                                    "
                                    :id="setting"
                                    :change="updateUserSetting"
                                    :modname="module"
                                    :placeholder="
                                        settings[module][setting].default
                                    "
                                    :value="settings[module][setting].value" />
                                <refresher-range
                                    v-else-if="
                                        settings[module][setting].type ===
                                        'range'
                                    "
                                    :id="setting"
                                    :change="updateUserSetting"
                                    :max="settings[module][setting].max"
                                    :min="settings[module][setting].min"
                                    :modname="module"
                                    :placeholder="
                                        settings[module][setting].default
                                    "
                                    :step="settings[module][setting].step"
                                    :unit="settings[module][setting].unit"
                                    :value="
                                        Number(settings[module][setting].value)
                                    " />
                                <refresher-options
                                    v-else-if="
                                        settings[module][setting].type ===
                                        'option'
                                    "
                                    :change="updateUserSetting"
                                    :modname="module"
                                    :options="
                                        settings[module][setting].items
                                    " />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div
                v-show="tab === 1"
                key="tab2"
                class="tab tab2">
                <div v-if="!Object.keys(settings).length">
                    <h3 class="need-refresh">
                        우선 디시 페이지를 열고 설정 해주세요.
                    </h3>
                </div>
                <div
                    v-for="module in Object.keys(settings)"
                    v-if="settings[module] &amp;&amp; advancedSettingsCount(settings[module])"
                    class="refresher-setting-category">
                    <h3 @click="moveToModuleTab(module)">
                        {{ module }}
                        <svg
                            fill="black"
                            height="18px"
                            viewBox="0 0 24 24"
                            width="18px"
                            xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M0 0h24v24H0z"
                                fill="none" />
                            <path
                                d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                        </svg>
                    </h3>
                    <div
                        v-for="setting in Object.keys(settings[module])"
                        v-if="settings[module][setting].advanced"
                        :data-changed="
                            settings[module][setting].value !==
                            settings[module][setting].default
                        "
                        class="refresher-setting">
                        <div class="info">
                            <h4>{{ settings[module][setting].name }}</h4>
                            <p>{{ settings[module][setting].desc }}</p>
                            <p class="mute">
                                (기본 값 :
                                {{
                                    typeWrap(settings[module][setting].default)
                                }})
                            </p>
                        </div>
                        <div class="control">
                            <refresher-checkbox
                                v-if="
                                    settings[module][setting].type === 'check'
                                "
                                :id="setting"
                                :change="updateUserSetting"
                                :checked="settings[module][setting].value"
                                :modname="module" />
                            <refresher-input
                                v-if="settings[module][setting].type === 'text'"
                                :id="setting"
                                :change="updateUserSetting"
                                :modname="module"
                                :placeholder="settings[module][setting].default"
                                :value="settings[module][setting].value" />
                            <refresher-range
                                v-if="
                                    settings[module][setting].type === 'range'
                                "
                                :id="setting"
                                :change="updateUserSetting"
                                :max="settings[module][setting].max"
                                :min="settings[module][setting].min"
                                :modname="module"
                                :placeholder="settings[module][setting].default"
                                :step="settings[module][setting].step"
                                :unit="settings[module][setting].unit"
                                :value="
                                    Number(settings[module][setting].value)
                                " />
                        </div>
                    </div>
                </div>
            </div>
            <div
                v-show="tab === 2"
                key="tab3"
                class="tab tab3">
                <div style="margin-bottom: 10px">
                    <h2>차단 모드</h2>

                    <div
                        v-for="key in Object.keys(blocks)"
                        style="margin-top: 5px; margin-bottom: 5px">
                        <label>{{ blockKeyNames[key] }}:</label>
                        <select
                            v-model="blockModes[key]"
                            @change="editBlockMode">
                            <option
                                v-for="[key2, value2] in Object.entries(
                                    blockDetectModeTypeNames
                                )"
                                :selected="blockModes[key] === key2"
                                :value="key2">
                                {{ value2 }}
                            </option>
                        </select>
                    </div>
                </div>
                <div
                    v-for="key in Object.keys(blocks)"
                    class="block-divide">
                    <h3>
                        {{ blockKeyNames[key] }} ({{ blocks[key].length }}개)

                        <span
                            class="plus"
                            @click="() => addEmptyBlockedUser(key)">
                            <svg
                                fill="black"
                                height="18px"
                                viewBox="0 0 24 24"
                                width="18px"
                                xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M0 0h24v24H0z"
                                    fill="none" />
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                            </svg>
                        </span>
                    </h3>
                    <div class="lists">
                        <p v-if="!blocks[key].length">
                            차단된 {{ blockKeyNames[key] }} 없음
                        </p>

                        <refresher-bubble
                            v-for="(blocked, i) in blocks[key]"
                            v-else-if="key !== 'DCCON'"
                            :key="`block:${i}`"
                            :extra="blocked.extra"
                            :gallery="blocked.gallery"
                            :regex="blocked.isRegex"
                            :remove="() => removeBlockedUser(key, i)"
                            :text="blocked.content"
                            :textclick="() => editBlockedUser(key, i)" />

                        <refresher-bubble
                            v-for="(blocked, i) in blocks[key]"
                            v-else
                            :key="`block:${i}`"
                            :extra="blocked.extra"
                            :gallery="blocked.gallery"
                            :image="`https://dcimg5.dcinside.com/dccon.php?no=${blocked.content}`"
                            :regex="blocked.isRegex"
                            :remove="() => removeBlockedUser(key, i)"
                            :textclick="() => editBlockedUser(key, i)" />
                    </div>
                </div>
            </div>
            <div
                v-show="tab === 3"
                key="tab4"
                class="tab tab4">
                <div
                    v-for="key in Object.keys(memos)"
                    class="block-divide">
                    <h3>
                        {{ memoKeyNames[key] }} ({{
                            Object.keys(memos[key]).length
                        }}개)
                        <span
                            class="plus"
                            @click="addMemoUser(key)">
                            <svg
                                fill="black"
                                height="18px"
                                viewBox="0 0 24 24"
                                width="18px"
                                xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M0 0h24v24H0z"
                                    fill="none" />
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                            </svg>
                        </span>
                    </h3>

                    <div class="lists">
                        <p v-if="!Object.keys(memos[key]).length">
                            {{ memoKeyNames[key] }} 메모 없음
                        </p>
                        <refresher-bubble
                            v-for="[user, memo] in Object.entries(memos[key])"
                            v-else
                            :key="`memo:${user}`"
                            :remove="() => removeMemoUser(key, user)"
                            :text="`${user} (${memo.text.substring(0, 10)})`"
                            :textclick="() => editMemoUser(key, user)" />
                    </div>
                </div>
            </div>
            <div
                v-show="tab === 4"
                key="tab5"
                class="tab tab5">
                <img
                    style="width: 100px; height: 100px"
                    src="https://pbs.twimg.com/media/E_AGBpdUcAQzadz?format=jpg" />

                <h1>자짤 기능인줄 알았지? ㅋㅋㅋ "캬루" 지롱</h1>
            </div>
            <div
                v-show="tab === 5"
                key="tab6"
                class="tab tab6">
                <div
                    v-if="!Object.keys(modules).length"
                    class="refresher-no-modules">
                    <h3>로드된 모듈 없음</h3>
                    <p>우선 디시 페이지를 열어주세요.</p>
                </div>
                <div v-else>
                    <refresher-module
                        v-for="module in modules"
                        :key="module.name"
                        :author="module.author"
                        :desc="module.description"
                        :enabled="module.enable"
                        :name="module.name"
                        :requirement="module.require" />
                </div>
            </div>
            <div
                v-show="tab === 6"
                key="tab7"
                class="tab tab7">
                <div class="shortcut-lists">
                    <div
                        v-for="shortcut in shortcuts"
                        v-if="shortcut.description.length"
                        class="refresher-shortcut">
                        <p class="description">{{ shortcut.description }}</p>
                        <div class="key">
                            <refresher-bubble
                                v-for="key in shortcut.shortcut.match(
                                    shortcutRegex
                                )"
                                :key="key"
                                :text="key" />
                            <refresher-bubble
                                v-if="!shortcutRegex.test(shortcut.shortcut)"
                                text="키 없음" />
                        </div>
                    </div>
                </div>
                <p><a @click="openShortcutSettings">단축키 설정</a></p>
            </div>
        </transition-group>
    </div>
</template>

<script lang="ts">
    import checkbox from "./checkbox.vue";
    import module from "./module.vue";
    import options from "./options.vue";
    import input from "./input.vue";
    import range from "./range.vue";
    import bubble from "./bubble.vue";
    import browser from "webextension-polyfill";
    import Vue from "vue";
    import { TYPE_NAMES as MEMO_TYPE_NAMES } from "../../core/memo";
    import {
        BLOCK_DETECT_MODE_TYPE_NAMES,
        BlockModeCache,
        TYPE_NAMES as BLOCK_TYPE_NAMES
    } from "../../core/block";

    const port = browser.runtime.connect({ name: "refresherInternal" });

    interface RefresherData {
        tab: number;
        modules: {
            [key: string]: RefresherModule;
        };
        settings: {
            [key: string]: {
                [key: string]: RefresherSettings;
            };
        };
        shortcuts: {} | browser.Commands.Command[];
        blocks: {
            [key in RefresherBlockType]: RefresherBlockValue[];
        };
        blockModes: BlockModeCache;
        blockDetectModeTypeNames: typeof BLOCK_DETECT_MODE_TYPE_NAMES;
        memos: {
            [key in RefresherMemoType]: {
                [key: string]: RefresherMemoValue;
            };
        };
        memoKeyNames: typeof MEMO_TYPE_NAMES;
        shortcutRegex: RegExp;
        blockKeyNames: typeof BLOCK_TYPE_NAMES;
        links: { text: string; url: string }[];
    }

    export default Vue.extend({
        name: "refresher",
        data(): RefresherData {
            return {
                tab: 0,
                modules: {},
                settings: {},
                shortcuts: {},
                blocks: {
                    NICK: [],
                    ID: [],
                    IP: [],
                    TITLE: [],
                    TEXT: [],
                    COMMENT: [],
                    DCCON: []
                },
                blockModes: {},
                blockDetectModeTypeNames: BLOCK_DETECT_MODE_TYPE_NAMES,
                memos: {
                    UID: {},
                    NICK: {},
                    IP: {}
                },
                memoKeyNames: MEMO_TYPE_NAMES,
                shortcutRegex:
                    /(Space|⌥|⇧|⌘|⌃|Alt|Cmd|,|'|`|Home|End|PageUp|PageDown|Insert|Delete|Left|Up|Right|Down|[A-Z]|[0-9])/g,
                blockKeyNames: BLOCK_TYPE_NAMES,
                links: [
                    {
                        text: "GitHub",
                        url: "https://github.com/green1052/DCRefresher-Reborn"
                    },
                    {
                        text: "Discord",
                        url: "https://discord.gg/SSW6Zuyjz6"
                    }
                ]
            };
        },
        methods: {
            getVersion() {
                return browser.runtime.getManifest().version;
            },
            getURL(url: string) {
                return browser.runtime.getURL(url);
            },
            open(url: string) {
                browser.tabs.create({ url });
            },
            openShortcutSettings() {
                browser.tabs.create({
                    url: /Firefox/.test(navigator.userAgent)
                        ? "about:addons"
                        : "chrome://extensions/shortcuts"
                });
            },
            typeWrap(value: unknown) {
                if (typeof value === "boolean") {
                    return value ? "On" : "Off";
                }

                return value;
            },
            moveToModuleTab(moduleName: string) {
                this.tab = 5;

                for (const element of this.$el.querySelectorAll(
                    ".refresher-module.highlight"
                )) {
                    element.classList.remove("highlight");
                }

                for (const module of this.$el.querySelectorAll<HTMLElement>(
                    ".tab .refresher-module .title"
                )) {
                    if (module.innerText !== moduleName) continue;

                    requestAnimationFrame(() => {
                        module.parentElement?.parentElement?.classList.add(
                            "highlight"
                        );

                        module.scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                        });

                        setTimeout(() => {
                            for (const element of this.$el.querySelectorAll(
                                ".refresher-module.highlight"
                            )) {
                                element.classList.remove("highlight");
                            }
                        }, 1000);
                    });
                }
            },
            advancedSettingsCount(obj: Record<string, RefresherSettings>) {
                return Object.keys(obj).filter((v) => obj[v]?.advanced).length;
            },
            updateUserSetting(module: string, key: string, value: unknown) {
                this.settings[module][key].value = value;

                port.postMessage({
                    updateUserSetting: true,
                    name: module,
                    key,
                    value,
                    settings_store: this.settings
                });

                browser.tabs.query({ active: true }).then((tabs) => {
                    browser.tabs.sendMessage(tabs[0].id!, {
                        type: "updateSettingValue",
                        data: {
                            name: module,
                            key,
                            value
                        }
                    });
                });
            },
            syncBlock() {
                port.postMessage({
                    updateBlocks: true,
                    blocks_store: this.blocks,
                    blockModes_store: this.blockModes
                });

                browser.tabs.query({ active: true }).then((tabs) => {
                    browser.tabs.sendMessage(tabs[0].id!, {
                        type: "updateBlocks",
                        data: {
                            blocks: this.blocks,
                            modes: this.blockModes
                        }
                    });
                });
            },
            addEmptyBlockedUser(key: RefresherBlockType) {
                if (key === "DCCON") {
                    alert(
                        "디시콘 수동 차단은 아직 지원하지 않습니다, 우클릭 메뉴를 이용해주세요."
                    );
                    return;
                }

                const result = prompt(
                    `추가할 ${this.blockKeyNames[key]} 값을 입력하세요.`
                );

                if (!result) return;

                let isRegex = false;
                const extra: string[] = [];

                if (confirm("정규식입니까?")) {
                    isRegex = true;
                    extra.push("[정규식]");
                }

                let gallery: string | undefined = undefined;

                if (confirm("특정 갤러리에서만 차단하시겠습니까?")) {
                    const id = prompt("갤러리 아이디를 입력해주세요.");

                    if (id) {
                        gallery = id;
                    } else {
                        alert("갤러리 아이디가 잘못됐습니다.");
                        return;
                    }
                }

                let mode: RefresherBlockDetectMode | undefined = undefined;

                if (
                    confirm(
                        `차단 모드를 설정하시겠습니까? 현재 값: ${
                            this.blockDetectModeTypeNames[this.blockModes[key]]
                        }`
                    )
                ) {
                    const modes = Object.keys(this.blockDetectModeTypeNames);

                    const inputMode = prompt(
                        `차단 모드를 입력해주세요. (모드 목록: ${modes.join(
                            ", "
                        )})`
                    );

                    if (
                        inputMode &&
                        modes.includes(inputMode as RefresherBlockDetectMode)
                    ) {
                        mode = inputMode as RefresherBlockDetectMode;
                        extra.push(`[${this.blockDetectModeTypeNames[mode]}]`);
                    } else {
                        alert("모드가 잘못됐습니다.");
                        return;
                    }
                }

                this.blocks[key].push({
                    content: result,
                    isRegex,
                    extra: extra.length ? extra.join(" ") : undefined,
                    gallery,
                    mode
                });

                this.syncBlock();
            },
            removeBlockedUser(key: RefresherBlockType, index: number) {
                this.blocks[key].splice(index, 1);
                this.syncBlock();
            },
            editBlockedUser(key: RefresherBlockType, index: number) {
                const result = prompt(
                    `바꿀 ${this.blockKeyNames[key]} 값을 입력하세요.`
                );

                if (!result) return;

                this.blocks[key][index].content = result;
                this.syncBlock();
            },
            editBlockMode() {
                this.syncBlock();
            },
            syncMemos() {
                port.postMessage({
                    updateMemos: true,
                    memos_store: this.memos
                });

                browser.tabs.query({ active: true }).then((tabs) => {
                    browser.tabs.sendMessage(tabs[0].id!, {
                        type: "updateMemos",
                        data: {
                            memos: this.memos
                        }
                    });
                });
            },
            removeMemoUser(type: RefresherMemoType, user: string) {
                const obj = { ...this.memos };
                delete obj[type][user];
                this.memos = obj;

                this.syncMemos();
            },
            addMemoUser(type: RefresherMemoType) {
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
            },
            editMemoUser(type: RefresherMemoType, user: string) {
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
            },
            updateDarkMode(v: string) {
                document.documentElement.classList[v ? "add" : "remove"](
                    "refresherDark"
                );
            }
        },

        mounted() {
            port.postMessage({
                requestRefresherModules: true,
                requestRefresherSettings: true,
                requestRefresherBlocks: true,
                requestRefresherMemos: true
            });

            port.onMessage.addListener((msg) => {
                if (msg.responseRefresherModules) {
                    this.modules = msg.modules ?? {};
                }

                if (msg.responseRefresherSettings) {
                    this.settings = msg.settings ?? {};
                }

                if (msg.responseRefresherBlocks) {
                    this.blocks = msg.blocks ?? {};
                    this.blockModes = msg.blockModes ?? {};
                }

                if (msg.requestRefresherMemos) {
                    this.memos = msg.memos ?? {};
                }
            });

            browser.commands.getAll().then((cmd) => {
                this.shortcuts = cmd;
            });
        },

        watch: {
            modules(modules) {
                if (modules["다크 모드"]) {
                    this.updateDarkMode(modules["다크 모드"].enable);
                }
            }
        },

        components: {
            "refresher-checkbox": checkbox,
            "refresher-module": module,
            "refresher-options": options,
            "refresher-input": input,
            "refresher-range": range,
            "refresher-bubble": bubble
        }
    });
</script>

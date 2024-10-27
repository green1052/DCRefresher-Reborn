<template>
    <div id="refresher-app">
        <div class="refresher-add-block-popup"/>
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
                        <img v-if="easterEgg"
                             :src="getURL('/assets/icons/reboot.webp')"
                             class="icon"/>
                        <img v-else
                             :src="getURL('/assets/icons/logo/Icon.png')"
                             class="icon"/>
                    </div>

                    <div class="text">
                        <h3>{{ easterEgg ? "(경) 쌀먹충 정상화 (축)" : "DCRefresher Reborn" }}</h3>
                        <p>
                            <span class="version">{{ getVersion() }}<a href="https://github.com/green1052/DCRefresher-Reborn?tab=readme-ov-file#%EC%A0%95%EC%83%81%ED%99%94-%EA%B3%B5%EC%A7%80"
                                                                       target="_blank">(개발 잠정 중단)</a></span>
                            <a v-for="link in links" @click="open(link.url)">{{ link.text }}</a>
                        </p>
                        <p>
                            <span class="version">
                                데이터베이스 버전: {{ databaseVersion || "미설치" }}
                                <svg
                                    height="12px"
                                    style="cursor: pointer"
                                    viewBox="0 0 30 30"
                                    width="12px"
                                    xmlns="http://www.w3.org/2000/svg"
                                    @click="updateIpDatabase">
                                    <path
                                        d="M 15 3 C 12.031398 3 9.3028202 4.0834384 7.2070312 5.875 A 1.0001 1.0001 0 1 0 8.5058594 7.3945312 C 10.25407 5.9000929 12.516602 5 15 5 C 20.19656 5 24.450989 8.9379267 24.951172 14 L 22 14 L 26 20 L 30 14 L 26.949219 14 C 26.437925 7.8516588 21.277839 3 15 3 z M 4 10 L 0 16 L 3.0507812 16 C 3.562075 22.148341 8.7221607 27 15 27 C 17.968602 27 20.69718 25.916562 22.792969 24.125 A 1.0001 1.0001 0 1 0 21.494141 22.605469 C 19.74593 24.099907 17.483398 25 15 25 C 9.80344 25 5.5490109 21.062074 5.0488281 16 L 8 16 L 4 10 z"/>
                                </svg>
                            </span>
                        </p>
                    </div>
                </div>

                <div class="settings">
                    <div v-if="!Object.keys(settings).length">
                        <h3 class="need-refresh">
                            우선 디시인사이드 페이지를 열고 설정 해주세요.
                        </h3>
                    </div>
                    <Fragment v-else>
                        <div
                            v-for="module in Object.keys(settings)"
                            v-if="modules[module].enable && settings[module] && settingsCount(settings[module])"
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
                                        d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                                </svg>
                            </h3>

                            <div
                                v-for="setting in Object.keys(settings[module])"
                                v-if="!settings[module][setting].advanced"
                                :data-changed="settings[module][setting].value !== settings[module][setting].default"
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
                                        :modname="module"/>
                                    <refresher-input
                                        v-else-if="settings[module][setting].type === 'text'"
                                        :id="setting"
                                        :change="updateUserSetting"
                                        :modname="module"
                                        :placeholder="settings[module][setting].default"
                                        :value="settings[module][setting].value"
                                    />
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
                                    "/>
                                    <refresher-options
                                        v-else-if="
                                        settings[module][setting].type ===
                                        'option'
                                    "
                                        :id="setting"
                                        :change="updateUserSetting"
                                        :modname="module"
                                        :options="settings[module][setting].items"
                                        :value="settings[module][setting].value"
                                    />
                                </div>
                            </div>
                        </div>
                    </Fragment>
                </div>
            </div>
            <div
                v-show="tab === 1"
                key="tab2"
                class="tab tab2">

                <div v-if="!Object.keys(settings).length">
                    <h3 class="need-refresh">
                        우선 디시인사이드 페이지를 열고 설정 해주세요.
                    </h3>
                </div>
                <Fragment v-else>
                    <div
                        v-for="module in Object.keys(settings)"
                        v-if="modules[module].enable && settings[module] && advancedSettingsCount(settings[module])"
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
                                    fill="none"/>
                                <path
                                    d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                            </svg>
                        </h3>

                        <div
                            v-for="setting in Object.keys(settings[module])"
                            v-if="settings[module][setting].advanced"
                            :data-changed="settings[module][setting].value !== settings[module][setting].default"
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
                                    :modname="module"/>
                                <refresher-input
                                    v-else-if="settings[module][setting].type === 'text'"
                                    :id="setting"
                                    :change="updateUserSetting"
                                    :modname="module"
                                    :placeholder="settings[module][setting].default"
                                    :value="settings[module][setting].value"
                                />
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
                                    "/>
                                <refresher-options
                                    v-else-if="
                                        settings[module][setting].type ===
                                        'option'
                                    "
                                    :id="setting"
                                    :change="updateUserSetting"
                                    :modname="module"
                                    :options="settings[module][setting].items"
                                    :value="settings[module][setting].value"
                                />
                            </div>
                        </div>
                    </div>
                </Fragment>
            </div>
            <div
                v-show="tab === 2"
                key="tab3"
                class="tab tab3">
                <div style="margin-bottom: 15px">
                    <h2>데이터 관리</h2>

                    <div style="margin-top: 5px; float: left">
                        <button @click="exportBlock">내보내기</button>
                        <button @click="importBlock">가져오기</button>
                    </div>

                    <br>
                    <br>

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
                                    fill="none"/>
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                        </span>

                        <span
                            class="remove"
                            @click="() => removeAllBlockedUser(key)">
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
                            :textclick="() => editBlockedUser(key, i)"/>

                        <refresher-bubble
                            v-for="(blocked, i) in blocks[key]"
                            v-else
                            :key="`block:${i}`"
                            :extra="blocked.extra"
                            :gallery="blocked.gallery"
                            :image="`https://image.dcinside.com/dccon.php?no=${blocked.isRegex ? blocked.content.match(/^\^\((\w*)\|/)[1] : blocked.content}`"
                            :regex="blocked.isRegex"
                            :remove="() => removeBlockedUser(key, i)"
                            :textclick="() => editBlockedUser(key, i)"/>
                    </div>
                </div>
            </div>
            <div
                v-show="tab === 3"
                key="tab4"
                class="tab tab4">

                <div style="margin-bottom: 15px">
                    <h2>데이터 관리</h2>

                    <div style="margin-top: 5px; float: left">
                        <button @click="exportMemo">내보내기</button>
                        <button @click="importMemo">가져오기</button>
                    </div>

                    <br>
                </div>

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
                                    fill="none"/>
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                        </span>

                        <span
                            class="remove"
                            @click="() => removeAllMemoUser(key)">
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
                            :textclick="() => editMemoUser(key, user)"/>
                    </div>
                </div>
            </div>
            <div
                v-show="tab === 4"
                key="tab5"
                class="tab tab5">
                <img
                    :src="getURL('/assets/icons/god2.webp')"
                    style="width: 100px; height: 100px"/>

                <h1>전투력 5천 이하는 사용 불가능한 기능입니다.</h1>
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
                        :desc="module.description"
                        :enabled="module.enable"
                        :name="module.name"
                        :requirement="module.require"/>
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
                                :text="key"/>
                            <refresher-bubble
                                v-if="!shortcutRegex.test(shortcut.shortcut)"
                                text="키 없음"/>
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
import {TYPE_NAMES as MEMO_TYPE_NAMES} from "../../core/memo";
import {BLOCK_DETECT_MODE_TYPE_NAMES, BlockModeCache, TYPE_NAMES as BLOCK_TYPE_NAMES} from "../../core/block";
import $ from "cash-dom";
import storage from "../../utils/storage";
import ky from "ky";
import {Fragment} from "vue-fragment";

interface RefresherData {
    easterEgg: boolean;
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
    databaseVersion: string;
}

const port = browser.runtime.connect({name: "refresherInternal"});

export default Vue.extend({
    name: "refresher",
    data(): RefresherData {
        return {
            easterEgg: false,
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
                DCCON: [],
                TAB: [],
                IMAGE: []
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
                },
                {
                    text: "후원",
                    url: "https://www.buymeacoffee.com/green1052"
                }
            ],
            databaseVersion: ""
        };
    },
    methods: {
        exportMemo() {
            navigator.clipboard.writeText(JSON.stringify(this.memos, null, 4))
                .then(() => {
                    alert("클립보드에 복사되었습니다.");
                })
                .catch(() => {
                    alert("클립보드에 복사하지 못했습니다.");
                });
        },
        importMemo() {
            const result = prompt("가져올 데이터를 입력하세요.");

            if (!result) return;

            try {
                const data = JSON.parse(result);

                for (const [key, value] of Object.entries(data)) {
                    const target = this.memos[key as RefresherMemoType];

                    for (const [id, memo] of Object.entries(value as Record<string, RefresherMemoValue>)) {
                        if (target[id] && !confirm(`${id}에 대한 메모가 이미 존재합니다, 덮어쓰시겠습니까?`)) {
                            continue;
                        }

                        target[id] = memo;
                    }
                }

                this.syncMemos();

                alert("가져오기에 성공했습니다.");
            } catch (e) {
                alert("데이터가 잘못됐습니다.");
            }
        },
        exportBlock() {
            navigator.clipboard.writeText(JSON.stringify(this.blocks, null, 4))
                .then(() => {
                    alert("클립보드에 복사되었습니다.");
                })
                .catch(() => {
                    alert("클립보드에 복사하지 못했습니다.");
                });
        },
        importBlock() {
            const result = prompt("가져올 데이터를 입력하세요.");

            if (!result) return;

            try {
                const data = JSON.parse(result);

                for (const [key, value] of Object.entries(data)) {
                    const target = this.blocks[key as RefresherBlockType];

                    for (const block of value as RefresherBlockValue[]) {
                        if (target.some((v) => v.content === block.content) && !confirm(`${block.content}가 이미 존재합니다, 덮어쓰시겠습니까?`)) {
                            continue;
                        }

                        target.push(block);
                    }
                }

                this.syncBlock();

                alert("가져오기에 성공했습니다.");
            } catch (e) {
                alert("데이터가 잘못됐습니다.");
            }
        },
        getVersion() {
            return browser.runtime.getManifest().version_name ?? browser.runtime.getManifest().version;
        },
        getURL(url: string) {
            return browser.runtime.getURL(url);
        },
        open(url: string) {
            browser.tabs.create({url});
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

            if (typeof value === "string" && value === "") {
                return "없음";
            }

            return value;
        },
        moveToModuleTab(moduleName: string) {
            this.tab = 5;

            const $el = $(this.$el);

            for (const element of $el.find(".refresher-module.highlight")) {
                $(element).removeClass("highlight");
            }

            for (const element of $el.find(
                ".tab .refresher-module .title"
            )) {
                const $element = $(element);

                if ($element.text() !== moduleName) continue;

                requestAnimationFrame(() => {
                    $element.parent().parent().addClass("highlight");

                    element.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });

                    setTimeout(() => {
                        for (const element of $el.find(
                            ".refresher-module.highlight"
                        )) {
                            $(element).removeClass("highlight");
                        }
                    }, 1000);
                });
            }
        },
        settingsCount(obj: Record<string, RefresherSettings>) {
            return Object.values(obj).filter((v) => !v?.advanced).length;
        },
        advancedSettingsCount(obj: Record<string, RefresherSettings>) {
            return Object.values(obj).filter((v) => v?.advanced === true).length;
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
        },
        syncBlock() {
            port.postMessage({
                updateBlocks: true,
                blocks_store: this.blocks,
                blockModes_store: this.blockModes
            });

            browser.tabs.query({active: true}).then((tabs) => {
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
        removeAllBlockedUser(key: RefresherBlockType) {
            if (!confirm("ㄹ?ㅇ")) return;
            this.blocks[key] = [];
            this.syncBlock();
        },
        editBlockedUser(key: RefresherBlockType, index: number) {
            if (key === "DCCON") {
                alert(
                    "디시콘 수정은 아직 지원하지 않습니다, 우클릭 메뉴를 이용해주세요."
                );
                return;
            }

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

            browser.tabs.query({active: true}).then((tabs) => {
                browser.tabs.sendMessage(tabs[0].id!, {
                    type: "updateMemos",
                    data: {
                        memos: this.memos
                    }
                });
            });
        },
        removeMemoUser(type: RefresherMemoType, user: string) {
            const obj = {...this.memos};
            delete obj[type][user];
            this.memos = obj;

            this.syncMemos();
        },
        removeAllMemoUser(type: RefresherMemoType) {
            if (!confirm("ㄹ?ㅇ")) return;
            this.memos[type] = {};
            this.syncMemos();
        },
        addMemoUser(type: RefresherMemoType) {
            const user = prompt("메모 대상을 입력하세요.");

            if (!user) return;

            browser.tabs
                .query({active: true, currentWindow: true})
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
                .query({active: true, currentWindow: true})
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
        updateDarkMode(value: boolean) {
            $(document.documentElement).toggleClass("refresherDark", value);
        },
        async updateIpDatabase() {
            try {
                const [version, ip, ban] = await Promise.all([
                    ky.get("https://dcrefresher.green1052.com/data/version").text(),
                    ky.get("https://dcrefresher.green1052.com/data/ip.json").json(),
                    ky.get("https://dcrefresher.green1052.com/data/ban.json").json()
                ]);

                storage.set("refresher.database.ip", ip);
                storage.set("refresher.database.ban", ban);
                storage.set("refresher.database.version", version);
                storage.set("refresher.database.lastUpdate", Date.now());

                alert("데이터베이스 업데이트에 성공했습니다.");
            } catch (e) {
                alert(
                    `데이터베이스 업데이트에 실패했습니다. 오류: ${e}`
                );
            }
        }
    },
    async mounted() {
        setTimeout(() => {
            this.easterEgg = true;
        }, 30000);

        port.postMessage({
            requestRefresherModules: true,
            requestRefresherSettings: true,
            requestRefresherBlocks: true,
            requestRefresherMemos: true
        });

        port.onMessage.addListener((message) => {
            if (message.responseRefresherModules && message.modules) {
                this.modules = message.modules;
            }

            if (message.responseRefresherSettings && message.settings) {
                this.settings = message.settings;
            }

            if (
                message.responseRefresherBlocks &&
                message.blocks &&
                message.blockModes
            ) {
                this.blocks = message.blocks;
                this.blockModes = message.blockModes;
            }

            if (message.requestRefresherMemos && message.memos) {
                this.memos = message.memos;
            }
        });

        this.shortcuts = await browser.commands.getAll();

        this.databaseVersion = await storage.get(
            "refresher.database.version"
        );
    },
    watch: {
        modules(modules) {
            if (modules["다크 모드"]) {
                this.updateDarkMode(modules["다크 모드"].enable || matchMedia("(prefers-color-scheme: dark)").matches);
            }
        }
    },
    components: {
        "refresher-checkbox": checkbox,
        "refresher-module": module,
        "refresher-options": options,
        "refresher-input": input,
        "refresher-range": range,
        "refresher-bubble": bubble,
        Fragment
    }
});
</script>

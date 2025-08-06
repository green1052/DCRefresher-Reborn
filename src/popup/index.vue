<template>
    <div id="refresher-app">
        <div
            v-if="showBlockDialog"
            class="block-dialog-backdrop"
            @click="closeBlockDialog"
        >
            <div
                class="block-dialog-content"
                @click.stop
            >
                <h3 class="head">{{ blockKeyNames[currentBlockType] }} 차단 추가</h3>

                <div class="memo-row">
                    <p>{{ blockKeyNames[currentBlockType] }}</p>

                    <refresher-input
                        :change="(a, b, value) => (blockFormData.content = value)"
                        :placeholder="`${blockKeyNames[currentBlockType]} 값을 입력하세요`"
                        @keyup.enter="confirmAddBlock"
                    />
                </div>

                <div class="memo-row">
                    <p>정규식 사용</p>

                    <refresher-checkbox
                        :change="(a, b, value) => (blockFormData.isRegex = value)"
                        :checked="blockFormData.isRegex"
                    />
                </div>

                <div class="memo-row">
                    <p>특정 갤러리 차단 (선택)</p>

                    <refresher-input
                        :change="(a, b, value) => (blockFormData.gallery = value)"
                        placeholder="갤러리 ID"
                    />
                </div>

                <div class="memo-row">
                    <p>차단 모드</p>

                    <refresher-options
                        :change="(a, b, value) => (blockFormData.mode = value)"
                        :options="{ NONE: '기본값', ...blockDetectModeTypeNames }"
                        :value="blockFormData.mode"
                    />
                </div>

                <div class="button-wrap">
                    <div @click="confirmAddBlock">
                        <p>추가</p>
                    </div>
                    <div @click="closeBlockDialog">
                        <p>취소</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="refresher-title-zone">
            <h1>설정</h1>
            <div class="float-right">
                <p
                    :class="{ active: tab === 0 }"
                    @click="() => (tab = 0)"
                >
                    일반
                </p>
                <p
                    :class="{ active: tab === 1 }"
                    @click="() => (tab = 1)"
                >
                    고급
                </p>
                <p
                    :class="{ active: tab === 2 }"
                    @click="() => (tab = 2)"
                >
                    차단
                </p>
                <p
                    :class="{ active: tab === 3 }"
                    @click="() => (tab = 3)"
                >
                    메모
                </p>
                <p
                    :class="{ active: tab === 4 }"
                    @click="() => (tab = 4)"
                >
                    모듈
                </p>
                <p
                    :class="{ active: tab === 5 }"
                    @click="() => (tab = 5)"
                >
                    단축키
                </p>
            </div>
        </div>
        <transition-group
            mode="in-out"
            name="refresher-slide-left"
        >
            <div
                v-show="tab === 0"
                key="tab1"
                class="tab tab1"
            >
                <div class="info">
                    <div class="icon-wrap">
                        <img
                            :src="Logo"
                            class="icon"
                        />
                    </div>

                    <div class="text">
                        <h3>DCRefresher Reborn</h3>
                        <p>
                            <span class="version">{{ getVersion() }}</span>
                            <a
                                v-for="link in links"
                                @click="open(link.url)"
                            >
                                {{ link.text }}
                            </a>
                        </p>
                        <p>
                            <span class="version">
                                데이터베이스 버전:
                                {{ databaseVersion || "미설치" }}
                                <svg
                                    height="12px"
                                    style="cursor: pointer"
                                    viewBox="0 0 30 30"
                                    width="12px"
                                    xmlns="http://www.w3.org/2000/svg"
                                    @click="updateIpDatabase"
                                >
                                    <path
                                        d="M 15 3 C 12.031398 3 9.3028202 4.0834384 7.2070312 5.875 A 1.0001 1.0001 0 1 0 8.5058594 7.3945312 C 10.25407 5.9000929 12.516602 5 15 5 C 20.19656 5 24.450989 8.9379267 24.951172 14 L 22 14 L 26 20 L 30 14 L 26.949219 14 C 26.437925 7.8516588 21.277839 3 15 3 z M 4 10 L 0 16 L 3.0507812 16 C 3.562075 22.148341 8.7221607 27 15 27 C 17.968602 27 20.69718 25.916562 22.792969 24.125 A 1.0001 1.0001 0 1 0 21.494141 22.605469 C 19.74593 24.099907 17.483398 25 15 25 C 9.80344 25 5.5490109 21.062074 5.0488281 16 L 8 16 L 4 10 z"
                                    />
                                </svg>
                            </span>
                        </p>
                    </div>
                </div>

                <div class="settings">
                    <div v-if="!Object.keys(settings).length">
                        <h3 class="need-refresh">우선 디시인사이드 페이지를 열고 설정 해주세요.</h3>
                    </div>
                    <Fragment v-else>
                        <div
                            v-for="module in Object.keys(settings)"
                            v-if="settings[module] && settingsCount(settings[module])"
                            :key="module"
                            class="refresher-setting-category"
                        >
                            <h3 @click="moveToModuleTab(module)">
                                {{ module }} {{ !modules[module].enable ? "(비활성화)" : "" }}
                                <svg
                                    fill="black"
                                    height="18px"
                                    viewBox="0 0 24 24"
                                    width="18px"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                                </svg>
                            </h3>

                            <div
                                v-for="setting in Object.keys(settings[module])"
                                v-if="!settings[module][setting].advanced"
                                :data-changed="settings[module][setting].value !== settings[module][setting].default"
                                class="refresher-setting"
                            >
                                <div class="info">
                                    <h4>
                                        {{ settings[module][setting].name }}
                                    </h4>
                                    <p>{{ settings[module][setting].desc }}</p>
                                    <p class="mute">
                                        (기본 값 :
                                        {{ typeWrap(settings[module][setting].default) }})
                                    </p>
                                </div>

                                <div class="control">
                                    <refresher-checkbox
                                        v-if="settings[module][setting].type === 'check'"
                                        :id="setting"
                                        :change="updateUserSetting"
                                        :checked="settings[module][setting].value"
                                        :disabled="!modules[module].enable"
                                        :modname="module"
                                    />
                                    <refresher-input
                                        v-else-if="settings[module][setting].type === 'text'"
                                        :id="setting"
                                        :change="updateUserSetting"
                                        :disabled="!modules[module].enable"
                                        :modname="module"
                                        :placeholder="settings[module][setting].default"
                                        :value="settings[module][setting].value"
                                    />
                                    <refresher-range
                                        v-else-if="settings[module][setting].type === 'range'"
                                        :id="setting"
                                        :change="updateUserSetting"
                                        :disabled="!modules[module].enable"
                                        :max="settings[module][setting].max"
                                        :min="settings[module][setting].min"
                                        :modname="module"
                                        :placeholder="settings[module][setting].default"
                                        :step="settings[module][setting].step"
                                        :unit="settings[module][setting].unit"
                                        :value="Number(settings[module][setting].value)"
                                    />
                                    <refresher-options
                                        v-else-if="settings[module][setting].type === 'option'"
                                        :id="setting"
                                        :change="updateUserSetting"
                                        :disabled="!modules[module].enable"
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
                class="tab tab2"
            >
                <div v-if="!Object.keys(settings).length">
                    <h3 class="need-refresh">우선 디시인사이드 페이지를 열고 설정 해주세요.</h3>
                </div>
                <Fragment v-else>
                    <div
                        v-for="module in Object.keys(settings)"
                        v-if="settings[module] && advancedSettingsCount(settings[module])"
                        class="refresher-setting-category"
                    >
                        <h3 @click="moveToModuleTab(module)">
                            {{ module }} {{ !modules[module].enable ? "(비활성화)" : "" }}
                            <svg
                                fill="black"
                                height="18px"
                                viewBox="0 0 24 24"
                                width="18px"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M0 0h24v24H0z"
                                    fill="none"
                                />
                                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                            </svg>
                        </h3>

                        <div
                            v-for="setting in Object.keys(settings[module])"
                            v-if="settings[module][setting].advanced"
                            :data-changed="settings[module][setting].value !== settings[module][setting].default"
                            class="refresher-setting"
                        >
                            <div class="info">
                                <h4>{{ settings[module][setting].name }}</h4>
                                <p>{{ settings[module][setting].desc }}</p>
                                <p class="mute">
                                    (기본 값 :
                                    {{ typeWrap(settings[module][setting].default) }})
                                </p>
                            </div>
                            <div class="control">
                                <refresher-checkbox
                                    v-if="settings[module][setting].type === 'check'"
                                    :id="setting"
                                    :change="updateUserSetting"
                                    :checked="settings[module][setting].value"
                                    :disabled="!modules[module].enable"
                                    :modname="module"
                                />
                                <refresher-input
                                    v-else-if="settings[module][setting].type === 'text'"
                                    :id="setting"
                                    :change="updateUserSetting"
                                    :disabled="!modules[module].enable"
                                    :modname="module"
                                    :placeholder="settings[module][setting].default"
                                    :value="settings[module][setting].value"
                                />
                                <refresher-range
                                    v-else-if="settings[module][setting].type === 'range'"
                                    :id="setting"
                                    :change="updateUserSetting"
                                    :disabled="!modules[module].enable"
                                    :max="settings[module][setting].max"
                                    :min="settings[module][setting].min"
                                    :modname="module"
                                    :placeholder="settings[module][setting].default"
                                    :step="settings[module][setting].step"
                                    :unit="settings[module][setting].unit"
                                    :value="Number(settings[module][setting].value)"
                                />
                                <refresher-options
                                    v-else-if="settings[module][setting].type === 'option'"
                                    :id="setting"
                                    :change="updateUserSetting"
                                    :disabled="!modules[module].enable"
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
                class="tab tab3"
            >
                <div style="margin-bottom: 15px">
                    <h2>데이터 관리</h2>

                    <div style="margin-top: 5px; float: left">
                        <button @click="exportBlock">내보내기</button>
                        <button @click="importBlock">가져오기</button>
                    </div>

                    <br />
                    <br />

                    <h2>차단 모드</h2>

                    <div
                        v-for="key in Object.keys(blocks)"
                        style="margin-top: 5px; margin-bottom: 5px"
                    >
                        <label>{{ blockKeyNames[key] }}:</label>
                        <select
                            v-model="blockModes[key]"
                            @change="editBlockMode"
                        >
                            <option
                                v-for="[key2, value2] in Object.entries(blockDetectModeTypeNames)"
                                :selected="blockModes[key] === key2"
                                :value="key2"
                            >
                                {{ value2 }}
                            </option>
                        </select>
                    </div>
                </div>
                <div
                    v-for="key in Object.keys(blocks)"
                    class="block-divide"
                >
                    <h3>
                        {{ blockKeyNames[key] }} ({{ blocks[key].length }}개)

                        <span
                            class="plus"
                            @click="() => addEmptyBlockedUser(key)"
                        >
                            <svg
                                fill="black"
                                height="18px"
                                viewBox="0 0 24 24"
                                width="18px"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M0 0h24v24H0z"
                                    fill="none"
                                />
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                            </svg>
                        </span>

                        <span
                            class="remove"
                            @click="() => removeAllBlockedUser(key)"
                        >
                            <svg
                                height="14"
                                viewBox="0 0 18 18"
                                width="14"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M14.53 4.53l-1.06-1.06L9 7.94 4.53 3.47 3.47 4.53 7.94 9l-4.47 4.47 1.06 1.06L9 10.06l4.47 4.47 1.06-1.06L10.06 9z"
                                />
                            </svg>
                        </span>
                    </h3>
                    <div class="lists">
                        <p v-if="!blocks[key].length">차단된 {{ blockKeyNames[key] }} 없음</p>

                        <refresher-bubble
                            v-for="(blocked, i) in blocks[key]"
                            v-else-if="key !== 'DCCON'"
                            :key="`block:${i}`"
                            :extra="blocked.extra"
                            :gallery="blocked.gallery"
                            :regex="blocked.isRegex"
                            :remove="() => removeBlockedUser(key, i)"
                            :text="blocked.content"
                            :textclick="() => editBlockedUser(key, i)"
                        />

                        <refresher-bubble
                            v-for="(blocked, i) in blocks[key]"
                            v-else
                            :key="`block:${i}`"
                            :extra="blocked.extra"
                            :gallery="blocked.gallery"
                            :image="`https://image.dcinside.com/dccon.php?no=${blocked.isRegex ? blocked.content.match(/^\^\((\w*)\|/)[1] : blocked.content}`"
                            :regex="blocked.isRegex"
                            :remove="() => removeBlockedUser(key, i)"
                            :textclick="() => editBlockedUser(key, i)"
                        />
                    </div>
                </div>
            </div>
            <div
                v-show="tab === 3"
                key="tab4"
                class="tab tab4"
            >
                <div style="margin-bottom: 15px">
                    <h2>데이터 관리</h2>

                    <div style="margin-top: 5px; float: left">
                        <button @click="exportMemo">내보내기</button>
                        <button @click="importMemo">가져오기</button>
                    </div>

                    <br />
                </div>

                <div
                    v-for="key in Object.keys(memos)"
                    class="block-divide"
                >
                    <h3>
                        {{ memoKeyNames[key] }} ({{ Object.keys(memos[key]).length }}개)
                        <span
                            class="plus"
                            @click="addMemoUser(key)"
                        >
                            <svg
                                fill="black"
                                height="18px"
                                viewBox="0 0 24 24"
                                width="18px"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M0 0h24v24H0z"
                                    fill="none"
                                />
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                            </svg>
                        </span>

                        <span
                            class="remove"
                            @click="() => removeAllMemoUser(key)"
                        >
                            <svg
                                height="14"
                                viewBox="0 0 18 18"
                                width="14"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M14.53 4.53l-1.06-1.06L9 7.94 4.53 3.47 3.47 4.53 7.94 9l-4.47 4.47 1.06 1.06L9 10.06l4.47 4.47 1.06-1.06L10.06 9z"
                                />
                            </svg>
                        </span>
                    </h3>

                    <div class="lists">
                        <p v-if="!Object.keys(memos[key]).length">{{ memoKeyNames[key] }} 메모 없음</p>
                        <refresher-bubble
                            v-for="[user, memo] in Object.entries(memos[key])"
                            v-else
                            :key="`memo:${user}`"
                            :remove="() => removeMemoUser(key, user)"
                            :text="`${user} (${memo.text.substring(0, 10)})`"
                            :textclick="() => editMemoUser(key, user)"
                        />
                    </div>
                </div>
            </div>
            <div
                v-show="tab === 4"
                key="tab5"
                class="tab tab5"
            >
                <div
                    v-if="!Object.keys(modules).length"
                    class="refresher-no-modules"
                >
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
                        :requirement="module.require"
                    />
                </div>
            </div>
            <div
                v-show="tab === 5"
                key="tab6"
                class="tab tab6"
            >
                <div class="shortcut-lists">
                    <div
                        v-for="shortcut in shortcuts"
                        v-if="shortcut?.description.length"
                        class="refresher-shortcut"
                    >
                        <p class="description">
                            {{ shortcut.description }}
                        </p>
                        <div class="key">
                            <refresher-bubble
                                v-for="key in shortcut.shortcut.match(shortcutRegex)"
                                :key="key"
                                :text="key"
                            />
                            <refresher-bubble
                                v-if="!shortcutRegex.test(shortcut.shortcut)"
                                text="없음"
                            />
                        </div>
                    </div>
                </div>
                <p><a @click="openShortcutSettings">단축키 설정</a></p>
            </div>
        </transition-group>
    </div>
</template>

<script lang="ts" setup>
import $ from "cash-dom";
import ky from "ky";
import { Fragment, nextTick, onMounted, reactive, ref } from "vue";
import browser from "webextension-polyfill";

import Logo from "~assets/oyster.webp";

import { BLOCK_DETECT_MODE_TYPE_NAMES, BlockModeCache, TYPE_NAMES as BLOCK_TYPE_NAMES } from "../core/block";
import { TYPE_NAMES as MEMO_TYPE_NAMES } from "../core/memo";
import storage from "../utils/storage";
import RefresherBubble from "~popup/components/bubble.vue";
import RefresherCheckbox from "~popup/components/checkbox.vue";
import RefresherModule from "~popup/components/module.vue";
import RefresherOptions from "~popup/components/options.vue";
import RefresherRange from "~popup/components/range.vue";
import RefresherInput from "~popup/components/refresherInput.vue";

const port = browser.runtime.connect({ name: "refresherInternal" });

const tab = ref(0);
const modules = ref<{ [key: string]: RefresherModule }>({});
const settings = ref<{ [key: string]: { [key: string]: RefresherSettings } }>({});
const shortcuts = ref<{} | browser.Commands.Command[]>({});
const blocks = reactive<{ [key in RefresherBlockType]: RefresherBlockValue[] }>({
    NICK: [],
    ID: [],
    IP: [],
    TITLE: [],
    TEXT: [],
    COMMENT: [],
    DCCON: [],
    TAB: [],
    IMAGE: []
});
const blockModes = ref<BlockModeCache>({});
const blockDetectModeTypeNames = BLOCK_DETECT_MODE_TYPE_NAMES;
const memos = reactive<{ [key in RefresherMemoType]: { [key: string]: RefresherMemoValue } }>({
    UID: {},
    NICK: {},
    IP: {}
});
const memoKeyNames = MEMO_TYPE_NAMES;
const shortcutRegex =
    /(Space|⌥|⇧|⌘|⌃|Alt|Cmd|,|'|`|Home|End|PageUp|PageDown|Insert|Delete|Left|Up|Right|Down|[A-Z]|[0-9])/g;
const blockKeyNames = BLOCK_TYPE_NAMES;
const links = [
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
    },
    {
        text: "도움말",
        url: "https://dcrefresher.green1052.com"
    }
];
const databaseVersion = ref("");

const showBlockDialog = ref(false);
const currentBlockType = ref<RefresherBlockType>("NICK");
const blockContentInput = ref<HTMLInputElement>();
const blockFormData = reactive({
    content: "",
    isRegex: false,
    gallery: "",
    mode: "NONE" as RefresherBlockDetectMode
});

onMounted(async () => {
    port.postMessage({
        requestRefresherModules: true,
        requestRefresherSettings: true,
        requestRefresherBlocks: true,
        requestRefresherMemos: true
    });

    port.onMessage.addListener((message) => {
        if (message.responseRefresherModules && message.modules) {
            modules.value = message.modules;
        }

        if (message.responseRefresherSettings && message.settings) {
            settings.value = message.settings;
        }

        if (message.responseRefresherBlocks && message.blocks && message.blockModes) {
            Object.assign(blocks, message.blocks);
            blockModes.value = message.blockModes;
        }

        if (message.requestRefresherMemos && message.memos) {
            Object.assign(memos, message.memos);
        }
    });

    shortcuts.value = await browser.commands.getAll();
    databaseVersion.value = await storage.get("refresher.database.version");
});

const exportMemo = () => {
    navigator.clipboard
        .writeText(JSON.stringify(memos))
        .then(() => {
            alert("클립보드에 복사되었습니다.");
        })
        .catch(() => {
            alert("클립보드에 복사하지 못했습니다.");
        });
};

const importMemo = () => {
    const result = prompt("가져올 데이터를 입력하세요.");

    if (!result) return;

    try {
        const data = JSON.parse(result);

        for (const [key, value] of Object.entries(data)) {
            const target = memos[key as RefresherMemoType];

            for (const [id, memo] of Object.entries(value as Record<string, RefresherMemoValue>)) {
                if (target[id] && !confirm(`${id}에 대한 메모가 이미 존재합니다, 덮어쓰시겠습니까?`)) {
                    continue;
                }

                target[id] = memo;
            }
        }

        syncMemos();

        alert("가져오기에 성공했습니다.");
    } catch (e) {
        alert("데이터가 잘못됐습니다.");
    }
};

const exportBlock = () => {
    navigator.clipboard
        .writeText(JSON.stringify(blocks))
        .then(() => {
            alert("클립보드에 복사되었습니다.");
        })
        .catch(() => {
            alert("클립보드에 복사하지 못했습니다.");
        });
};

const importBlock = () => {
    const result = prompt("가져올 데이터를 입력하세요.");

    if (!result) return;

    try {
        const data = JSON.parse(result);

        for (const [key, value] of Object.entries(data)) {
            const target = blocks[key as RefresherBlockType];

            for (const block of value as RefresherBlockValue[]) {
                if (
                    target.some((v) => v.content === block.content) &&
                    !confirm(`${block.content}가 이미 존재합니다, 덮어쓰시겠습니까?`)
                ) {
                    continue;
                }

                target.push(block);
            }
        }

        syncBlock();

        alert("가져오기에 성공했습니다.");
    } catch (e) {
        alert("데이터가 잘못됐습니다.");
    }
};

const getVersion = () => {
    return browser.runtime.getManifest().version_name ?? browser.runtime.getManifest().version;
};

const open = (url: string) => {
    browser.tabs.create({ url });
};

const openShortcutSettings = () => {
    browser.tabs.create({
        url: /Firefox/.test(navigator.userAgent) ? "about:addons" : "chrome://extensions/shortcuts"
    });
};

const typeWrap = (value: unknown) => {
    if (typeof value === "boolean") {
        return value ? "On" : "Off";
    }

    if (typeof value === "string" && value === "") {
        return "없음";
    }

    return value;
};

const moveToModuleTab = (moduleName: string) => {
    tab.value = 5;

    const $el = $("#refresher-app");

    for (const element of $el.find(".refresher-module.highlight")) {
        $(element).removeClass("highlight");
    }

    for (const element of $el.find(".tab .refresher-module .title")) {
        const $element = $(element);

        if ($element.text() !== moduleName) continue;

        requestAnimationFrame(() => {
            $element.parent().parent().addClass("highlight");

            element.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            setTimeout(() => {
                for (const element of $el.find(".refresher-module.highlight")) {
                    $(element).removeClass("highlight");
                }
            }, 1000);
        });
    }
};

const settingsCount = (obj: Record<string, RefresherSettings>) => {
    return Object.values(obj).filter((v) => !v?.advanced).length;
};

const advancedSettingsCount = (obj: Record<string, RefresherSettings>) => {
    return Object.values(obj).filter((v) => v?.advanced === true).length;
};

const updateUserSetting = (module: string, key: string, value: unknown) => {
    settings.value[module][key].value = value;

    port.postMessage({
        updateUserSetting: true,
        name: module,
        key,
        value,
        settings_store: settings.value
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
};

const syncBlock = () => {
    port.postMessage({
        updateBlocks: true,
        blocks_store: blocks,
        blockModes_store: blockModes.value
    });

    browser.tabs.query({ active: true }).then((tabs) => {
        browser.tabs.sendMessage(tabs[0].id!, {
            type: "updateBlocks",
            data: {
                blocks: blocks,
                modes: blockModes.value
            }
        });
    });
};

const openBlockDialog = (key: RefresherBlockType) => {
    if (key === "DCCON") {
        alert("디시콘 수동 차단은 아직 지원하지 않습니다, 우클릭 메뉴를 이용해주세요.");
        return;
    }

    currentBlockType.value = key;
    blockFormData.content = "";
    blockFormData.isRegex = false;
    blockFormData.gallery = "";
    blockFormData.mode = "NONE";
    showBlockDialog.value = true;

    nextTick(() => {
        blockContentInput.value?.focus();
    });
};

const closeBlockDialog = (event?: Event) => {
    showBlockDialog.value = false;
};

const confirmAddBlock = () => {
    if (!blockFormData.content.trim()) {
        alert(`${blockKeyNames[currentBlockType.value]} 값을 입력해주세요.`);
        return;
    }

    const extra: string[] = [];
    const isAdvanced = false;

    if (blockFormData.isRegex) {
        extra.push("[정규식]");
    }

    if (blockFormData.gallery.trim()) {
        extra.push(`[갤러리: ${blockFormData.gallery.trim()}]`);
    }

    if (blockFormData.mode && blockFormData.mode !== "NONE") {
        extra.push(`[${blockDetectModeTypeNames[blockFormData.mode]}]`);
    }

    blocks[currentBlockType.value].push({
        content: blockFormData.content.trim(),
        isRegex: blockFormData.isRegex,
        isAdvanced,
        extra: extra.length ? extra.join(" ") : undefined,
        gallery: blockFormData.gallery.trim() || undefined,
        mode: blockFormData.mode === "NONE" ? undefined : blockFormData.mode
    });

    syncBlock();
    closeBlockDialog();
};

// Legacy function for compatibility
const addEmptyBlockedUser = openBlockDialog;
const removeBlockedUser = (key: RefresherBlockType, index: number) => {
    blocks[key].splice(index, 1);
    syncBlock();
};
const removeAllBlockedUser = (key: RefresherBlockType) => {
    if (!confirm("ㄹ?ㅇ")) return;
    blocks[key] = [];
    syncBlock();
};
const editBlockedUser = (key: RefresherBlockType, index: number) => {
    if (key === "DCCON") {
        alert("디시콘 수정은 아직 지원하지 않습니다, 우클릭 메뉴를 이용해주세요.");
        return;
    }

    const result = prompt(`바꿀 ${blockKeyNames[key]} 값을 입력하세요.`);

    if (!result) return;

    blocks[key][index].content = result;
    syncBlock();
};
const editBlockMode = () => {
    syncBlock();
};
const syncMemos = () => {
    port.postMessage({
        updateMemos: true,
        memos_store: memos
    });

    browser.tabs.query({ active: true }).then((tabs) => {
        browser.tabs.sendMessage(tabs[0].id!, {
            type: "updateMemos",
            data: {
                memos: memos
            }
        });
    });
};
const removeMemoUser = (type: RefresherMemoType, user: string) => {
    delete memos[type][user];
    syncMemos();
};
const removeAllMemoUser = (type: RefresherMemoType) => {
    if (!confirm("ㄹ?ㅇ")) return;
    memos[type] = {};
    syncMemos();
};
const addMemoUser = (type: RefresherMemoType) => {
    const user = prompt("메모 대상을 입력하세요.");

    if (!user) return;

    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        browser.tabs.sendMessage(tabs[0].id!, {
            type: "refresherRequestMemoAsk",
            data: {
                type,
                user
            }
        });
    });
};
const editMemoUser = (type: RefresherMemoType, user: string) => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        browser.tabs.sendMessage(tabs[0].id!, {
            type: "refresherRequestMemoAsk",
            data: {
                type,
                user
            }
        });
    });
};
const updateIpDatabase = async () => {
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
        alert(`데이터베이스 업데이트에 실패했습니다. 오류: ${e}`);
    }
};
</script>

<style lang="scss">
@use "sass:color";

@keyframes refresher-logo-animation {
    0%,
    100% {
        filter: saturate(200%) blur(6px);
    }

    50% {
        filter: saturate(400%) blur(12px);
    }
}

@keyframes highlight-blink-dark {
    0%,
    50% {
        background-color: #223957;
    }

    40%,
    100% {
        background-color: #2c2c2c;
    }
}

body {
    font-family:
        -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans CJK KR", Roboto, Oxygen, Ubuntu, Cantarell,
        "Open Sans", "Helvetica Neue", sans-serif;
    overflow: hidden;
    background: #fff;

    ::-webkit-scrollbar {
        width: 10px;
    }

    ::-webkit-scrollbar-track {
        background: #f1f1f1;
    }

    ::-webkit-scrollbar-thumb {
        background: #888;
    }

    ::-webkit-scrollbar-thumb:hover {
        background: #555;
    }

    #refresher-app {
        height: 435px;
        width: 715px;
    }

    body {
        width: 90%;
        margin-left: 5%;
        margin-right: 5%;
        font-size: 100%;

        overflow: hidden;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    p,
    span {
        letter-spacing: -0.66px;
        margin: 0;
    }

    h1,
    h2,
    h3,
    h4,
    h5 {
        font-weight: bold;
    }

    h1 {
        font-size: 24px;
    }

    h2 {
        font-size: 22px;
    }

    h3 {
        font-size: 20px;
    }

    .settings {
        margin-top: 20px;

        .need-refresh {
            letter-spacing: -1.66px;
        }
    }

    .refresher-add-block-popup {
        display: flex;
    }

    .refresher-shortcut,
    .refresher-setting-category,
    .refresher-module {
        background-color: #f8f8f8;
    }

    .refresher-setting-category {
        border-radius: 13.3px;
        position: relative;
        z-index: 3;
        margin-bottom: 5%;
        padding: 4px 8px;
        margin-right: 3px;

        & > h3 {
            font-size: 20px;
            z-index: 5;

            border-radius: 13.3px;
            margin: 15px auto 20px 15px;
            cursor: pointer;
            display: flex;

            &:hover {
                opacity: 0.8;
            }

            &:active {
                opacity: 0.7;
            }

            svg {
                margin-left: 5px;
                margin-top: auto;
                margin-bottom: auto;
            }
        }

        .refresher-setting {
            position: relative;
            display: flex;
            width: 95%;
            margin-left: auto;
            margin-right: auto;
            margin-bottom: 15px;

            .info {
                transition: transform 0.24s cubic-bezier(0.19, 1, 0.22, 1);
            }

            .info,
            .control {
                transform: translateX(0px);
            }

            .info::before {
                content: " ";
                position: absolute;
                transition: opacity 0.15s cubic-bezier(0.19, 1, 0.22, 1);
                width: 4px;
                height: 100%;
                left: -12px;
                background-color: rgb(250, 200, 60);
                opacity: 0;
            }

            &[data-changed="true"] {
                margin-left: 20px;

                .info {
                    transform: translateX(10px);
                }

                .control {
                    transform: translateX(-5px);
                }

                .info::before {
                    opacity: 1;
                }
            }

            .info {
                flex: 8;
                display: block;
                margin-right: 15px;

                h4 {
                    font-size: 16px;
                    font-weight: 500;
                }

                p {
                    font-size: 14px;
                    color: rgb(109, 109, 109);
                }

                .mute {
                    font-size: 12px;
                    color: rgb(177, 177, 177);
                }
            }

            .control {
                flex: 2;
                display: flex;
                justify-content: center;

                .refresher-input {
                    margin-left: 10px;
                }

                * {
                    margin: auto;
                }

                input[type="text"] {
                    background-color: #fff;
                    border: 1px solid #aaa;
                    padding: 4px 16px;
                    border-radius: 9px;
                    font-size: 15px;
                    color: black;
                }
            }
        }
    }

    .refresher-range {
        display: flex;

        input {
            margin-right: 10px !important;
        }

        .indicator {
            color: #a0a0a0;
            font-size: 12px;
        }
    }

    .refresher-options {
        position: relative;
        display: inline-block;
        width: 150px;
        height: 25px;
        font-size: 15px;
        border: 1px solid #ccc;
        border-radius: 4px;
        overflow: hidden;
    }

    .tab {
        overflow: auto;
        position: absolute;
        width: 90%;
        height: 85%;
        padding-top: 40px;
        margin-top: 30px;

        & > *:first-child {
            margin-top: 5px;
        }
    }

    .refresher-title-zone {
        padding: 0 7.5vw 2vh 7.5vw;
        margin-top: 10px;
        margin-bottom: 10px;
        display: flex;
        width: 90%;
        left: 0;
        position: fixed;
        z-index: 10;
        background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 1),
            rgba(255, 255, 255, 1),
            rgba(255, 255, 255, 1),
            rgba(255, 255, 255, 0.9),
            rgba(255, 255, 255, 0.6),
            rgba(255, 255, 255, 0)
        );

        h1 {
            margin-top: auto;
            margin-bottom: auto;
        }

        .float-right {
            margin-left: auto;
            margin-right: 2.5vw;

            display: flex;

            p {
                margin: auto;
                padding: 5px 10px;
                font-weight: bold;
                font-size: 16px;
                color: #a0a0a0;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);

                &:hover {
                    color: rgb(177, 177, 177);
                }

                &:active {
                    color: rgb(197, 197, 197);
                }

                &.active {
                    color: #333;
                }
            }
        }
    }

    .icon-wrap {
        display: block;
        position: relative;
        width: 64px;
        height: 64px;
        margin: 20px;

        .icon,
        .icon-backdrop {
            position: absolute;
        }
    }

    .icon {
        width: 64px;
        height: 64px;
    }

    .icon-backdrop {
        width: 60px;
        height: 60px;
        left: 2px;
        right: 2px;
    }

    .icon-backdrop {
        filter: saturate(200%) blur(8px);

        animation: refresher-logo-animation 5s infinite;
        z-index: -1;
    }

    .tab1 .info {
        display: flex;
    }

    .tab1 .text {
        font-size: 16px;
        display: grid;

        h3 {
            margin-top: auto;
        }

        p {
            margin-bottom: auto;
        }

        .version {
            color: #333;
            font-weight: bold;
            margin-right: 5px;
        }
    }

    .tab3,
    .tab4 {
        .block-divide {
            margin-bottom: 10px;
        }

        h3 {
            margin-bottom: 5px;
            font-size: 18px;
            display: flex;

            .plus,
            .remove {
                margin-left: 5px;
                margin-top: auto;
                margin-bottom: auto;
                display: flex;
                border-radius: 50%;
                transition: 0.25s all cubic-bezier(0.19, 1, 0.22, 1);
                cursor: pointer;

                &:hover {
                    background-color: #eaeaea;
                }
            }
        }

        .gallery {
            margin-left: 3px;
            color: #7a7a7a;
        }

        .lists {
            display: flex;
            flex-wrap: wrap;

            p {
                color: #7a7a7a;
            }

            .refresher-bubble {
                margin-right: 10px;
            }
        }
    }

    a {
        margin-right: 5px;
        color: #2475ee;
        text-decoration: none;
        transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);
        cursor: pointer;
    }

    a:hover {
        color: #33a3ee;
    }

    a:active {
        color: #33b9ee;
    }

    a::after {
        content: "•";
        margin-left: 5px;
        border-radius: 50%;
    }

    a:last-child::after {
        display: none;
    }
}

@media (prefers-color-scheme: dark) {
    body {
        background: #222;
        color: white;

        ::-webkit-scrollbar-track {
            background: #3b3b3b;
        }

        ::-webkit-scrollbar-thumb {
            background: rgb(100, 100, 100);
        }

        ::-webkit-scrollbar-thumb:hover {
            background: rgb(124, 124, 124);
        }

        .refresher-shortcut,
        .refresher-setting-category,
        .refresher-module {
            background-color: #2c2c2c;
        }

        .refresher-setting-category {
            .refresher-setting {
                .info {
                    h4 {
                        font-size: 16px;
                        font-weight: 500;
                    }

                    p {
                        font-size: 14px;
                        color: rgb(190, 190, 190);
                    }

                    .mute {
                        font-size: 12px;
                        color: rgb(100, 100, 100);
                    }
                }

                .control {
                    input[type="text"] {
                        background-color: #3b3b3b;
                        border: 1px solid rgb(90, 90, 90);
                        color: white;
                    }
                }
            }
        }

        .tab1 .text .version {
            color: #dddddd;
        }

        .refresher-title-zone {
            background: linear-gradient(
                to bottom,
                #222,
                #222,
                rgb(34, 34, 34),
                rgba(34, 34, 34, 0.9),
                rgba(34, 34, 34, 0.6),
                rgba(34, 34, 34, 0)
            );

            .float-right {
                p {
                    $dark-floatright: #d2d2d2;
                    color: $dark-floatright;

                    &:hover {
                        color: color.adjust($dark-floatright, $lightness: -20%, $space: hsl);
                    }

                    &:active {
                        color: color.adjust($dark-floatright, $lightness: -30%, $space: hsl);
                    }

                    &.active {
                        color: color.adjust($dark-floatright, $lightness: -45%, $space: hsl);
                    }
                }
            }
        }

        .refresher-module {
            &.highlight {
                animation: highlight-blink-dark 1s;
            }
        }

        svg {
            filter: invert(1);
        }

        .tab3 {
            h3 {
                .plus {
                    &:hover {
                        background-color: #5c5c5c;
                    }
                }
            }

            .gallery {
                color: #7a7a7a;
            }

            .lists {
                p {
                    color: #7a7a7a;
                }
            }
        }

        .refresher-bubble {
            background-color: #3a3a3a;
            border: 1px solid #444;

            .remove {
                background-color: #666666;

                &:hover {
                    background-color: color.adjust(#666666, $lightness: 20%);
                }

                &:active {
                    background-color: color.adjust(#666666, $lightness: 30%);
                }
            }
        }
    }
}

@keyframes highlight-blink {
    0%,
    50% {
        background-color: #afdbff;
    }

    40%,
    100% {
        background-color: #f8f8f8;
    }
}

.refresher-module {
    position: relative;
    display: flex;

    border-radius: 13.3px;
    padding: 13px 23px;

    &.highlight {
        animation: highlight-blink 1s;
    }

    .left {
        letter-spacing: -0.66px;

        .title {
            font-weight: bold;
            font-size: 18px;
        }

        .desc {
            font-size: 14px;
        }

        .mute {
            color: #a0a0a0;
            font-size: 12px;

            letter-spacing: -0.66px;

            .link {
                border-bottom: 1px solid #a0a0a0;
                cursor: pointer;
            }
        }
    }

    .right {
        margin-left: auto;
        margin-top: auto;
        margin-bottom: auto;
    }

    margin-bottom: 5px;
}

.refresher-no-modules {
    margin-top: 160px;
    margin-left: 15px;

    h3 {
        font-size: 28px;
        letter-spacing: -2.66px;
        color: #a0a0a0;
        line-height: 1;
    }

    p {
        font-size: 16px;
        font-weight: bold;
    }
}

.refresher-bubble {
    display: flex;
    border-radius: 13.3px;
    background-color: #f9f9f9;
    border: 1px solid #d6d6d6;
    font-weight: normal;
    font-size: 14px;
    width: fit-content;
    padding: 3px 16px;

    .text {
        width: fit-content;
        height: 14px;

        &.image {
            img {
                width: 80px;
            }

            height: unset;
        }
    }

    .remove {
        margin: auto;
        margin-left: 5px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: #d6d6d6;
        transition: 0.25s all cubic-bezier(0.19, 1, 0.22, 1);

        font-weight: bold;
        text-align: center;

        &:hover {
            background-color: rgb(190, 190, 190);
        }

        &:active {
            background-color: rgb(155, 155, 155);
        }

        cursor: pointer;
        display: flex;
        justify-content: center;

        svg {
            margin: auto;
        }
    }
}

.shortcut-lists {
    margin-bottom: 20px;
}

.refresher-shortcut {
    display: flex;
    padding: 8px 16px;
    border-radius: 13.3px;
    margin-bottom: 5px;

    .key {
        margin-left: auto;
        display: flex;

        .refresher-bubble {
            margin-right: 5px;

            &:last-child {
                margin-right: unset;
            }
        }
    }

    &:last-child {
        margin-bottom: unset;
    }
}

// Block dialog styles
.block-dialog-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.6);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(2px);
    animation: backdrop-fade-in 0.3s ease-out;
    overflow-y: auto;
    padding: 20px;
    box-sizing: border-box;
}

.block-dialog-content {
    background: #ffffff;
    border-radius: 16px;
    padding: 32px;
    width: 100%;
    max-width: 500px;
    max-height: calc(100vh - 40px);
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    animation: dialog-slide-in 0.3s ease-out;
    margin: auto;
    position: relative;
    flex-shrink: 0;

    .head {
        font-size: 22px;
        font-weight: 700;
        margin-bottom: 28px;
        text-align: center;
        color: #2c3e50;
        border-bottom: 2px solid #f8f9fa;
        padding-bottom: 16px;
    }

    .memo-row {
        margin-bottom: 24px;

        > p {
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #343a40;
            display: block;
        }
    }

    .button-wrap {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 32px;
        padding-top: 20px;
        border-top: 1px solid #f1f3f4;
        cursor: pointer;
    }
}

@keyframes backdrop-fade-in {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes dialog-slide-in {
    from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

@media (prefers-color-scheme: dark) {
    .block-dialog-backdrop {
        background-color: rgba(0, 0, 0, 0.8);
    }

    .block-dialog-content {
        background: #1e1e1e;
        color: #ffffff;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);

        .head {
            color: #ffffff;
            border-bottom-color: #2f3349;
        }

        .memo-row {
            > p {
                color: #e9ecef;
            }
        }

        .button-wrap {
            border-top-color: #3a3f47;
        }
    }
}
</style>

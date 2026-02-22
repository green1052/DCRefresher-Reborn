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
                        :value="blockFormData.mode || 'NONE'"
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

        <transition-group name="refresher-slide-left">
            <div
                v-if="tab === 0"
                key="tab1"
                class="tab tab1"
            >
                <div class="info">
                    <div class="icon-wrap">
                        <img
                            :src="getURL(browser.runtime.getManifest().icons[128])"
                            class="icon"
                        />
                    </div>

                    <div class="text">
                        <h3>DCRefresher Reborn</h3>
                        <p>
                            <span class="version">{{ version }}</span>
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
                    <div v-if="Object.keys(settings).length === 0">
                        <h3 class="need-refresh">우선 디시인사이드 페이지를 열고 설정 해주세요.</h3>
                    </div>
                    <div v-else>
                        <settings-module
                            v-for="module in modulesWithBasicSettings"
                            :key="module"
                            :module-enabled="modules[module]?.enable ?? false"
                            :module-name="module"
                            :module-settings="settings[module]"
                            :move-to-module-tab="moveToModuleTab"
                            :show-advanced="false"
                            :type-wrap="typeWrap"
                            :update-user-setting="updateUserSetting"
                        />
                    </div>
                </div>
            </div>

            <div
                v-else-if="tab === 1"
                key="tab2"
                class="tab tab2"
            >
                <div v-if="Object.keys(settings).length === 0">
                    <h3 class="need-refresh">우선 디시인사이드 페이지를 열고 설정 해주세요.</h3>
                </div>
                <div v-else>
                    <settings-module
                        v-for="module in modulesWithAdvancedSettings"
                        :key="module"
                        :module-enabled="modules[module]?.enable ?? false"
                        :module-name="module"
                        :module-settings="settings[module]"
                        :move-to-module-tab="moveToModuleTab"
                        :show-advanced="true"
                        :type-wrap="typeWrap"
                        :update-user-setting="updateUserSetting"
                    />
                </div>
            </div>

            <div
                v-else-if="tab === 2"
                key="tab3"
                class="tab tab3"
            >
                <div style="margin-bottom: 15px">
                    <h2>데이터 관리</h2>

                    <div style="margin-top: 5px; float: left">
                        <button @click="exportBlock">내보내기</button>
                        <button @click="importBlock">가져오기</button>
                    </div>

                    <br/>
                    <br/>

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
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
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
                v-else-if="tab === 3"
                key="tab4"
                class="tab tab4"
            >
                <div style="margin-bottom: 15px">
                    <h2>데이터 관리</h2>

                    <div style="margin-top: 5px; float: left">
                        <button @click="exportMemo">내보내기</button>
                        <button @click="importMemo">가져오기</button>
                        <button @click="open('https://dcrefresher.green1052.com/utils/convert-memo')">메모 변환</button>
                    </div>

                    <br/>
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
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
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
                v-else-if="tab === 4"
                key="tab5"
                class="tab tab5"
            >
                <div
                    v-if="Object.keys(modules).length === 0"
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
                v-else-if="tab === 5"
                key="tab6"
                class="tab tab6"
            >
                <div class="shortcut-lists">
                    <template
                        v-for="shortcut in shortcuts"
                        :key="shortcut.id"
                    >
                        <div
                            v-if="shortcut.description.length"
                            class="refresher-shortcut"
                        >
                            <p class="description">
                                {{ shortcut.description }}
                            </p>
                            <div class="key">
                                <refresher-bubble :text="shortcut.shortcut || '없음'"/>
                            </div>
                        </div>
                    </template>
                </div>
                <p style="text-align: right; margin-right: 5px"><a @click="openShortcutSettings">단축키 설정</a></p>
            </div>
        </transition-group>
    </div>
</template>

<script lang="ts" setup>
import {sendToBackground} from "@plasmohq/messaging";
import $ from "cash-dom";
import ky from "ky";
import {computed, nextTick, onMounted, reactive, ref} from "vue";
import browser from "webextension-polyfill";

import {BLOCK_DETECT_MODE_TYPE_NAMES, BlockModeCache, TYPE_NAMES as BLOCK_TYPE_NAMES} from "../core/block";
import {TYPE_NAMES as MEMO_TYPE_NAMES} from "../core/memo";
import storage from "../utils/storage";
import {writeClipboard} from "../utils/writeClipboard";
import RefresherBubble from "./components/bubble.vue";
import RefresherCheckbox from "./components/checkbox.vue";
import RefresherModule from "./components/module.vue";
import RefresherOptions from "./components/options.vue";
import RefresherInput from "./components/refresherInput.vue";
import SettingsModule from "./components/settingsModule.vue";
import getURL from "~utils/getURL";

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
const blockKeyNames = BLOCK_TYPE_NAMES;
const links = [
    {
        text: "GitHub",
        url: "https://github.com/green1052/DCRefresher-Reborn"
    },
    {
        text: "갤러리",
        url: "https://gall.dcinside.com/mini/board/lists/?id=bjwg64"
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
    try {
        const [modulesResponse, blocksResponse, memosResponse] = await Promise.all([
            sendToBackground({
                name: "store",
                body: {action: "get", type: "modules"}
            }),
            sendToBackground({
                name: "store",
                body: {action: "get", type: "blocks"}
            }),
            sendToBackground({
                name: "store",
                body: {action: "get", type: "memos"}
            })
        ]);

        if (modulesResponse.modules) {
            modules.value = modulesResponse.modules;
        }

        if (modulesResponse.settings) {
            settings.value = modulesResponse.settings;
        }

        if (blocksResponse.blocks && blocksResponse.blockModes) {
            Object.assign(blocks, blocksResponse.blocks);
            blockModes.value = blocksResponse.blockModes;
        }

        if (memosResponse.memos) {
            Object.assign(memos, memosResponse.memos);
        }
    } catch {
    }

    shortcuts.value = await browser.commands.getAll();
    databaseVersion.value = await storage.get("refresher.database.version");
});

const exportMemo = () => {
    writeClipboard(JSON.stringify(memos))
        .then(() => {
            alert("클립보드에 복사되었습니다.");
        })
        .catch(() => {
            alert("클립보드에 복사하지 못했습니다.");
        });
};

const importMemo = () => {
    const result = prompt("가져올 데이터를 입력하세요.", `예시: {"UID":{},"NICK":{},"IP":{}}`);

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
    writeClipboard(JSON.stringify(blocks))
        .then(() => {
            alert("클립보드에 복사되었습니다.");
        })
        .catch(() => {
            alert("클립보드에 복사하지 못했습니다.");
        });
};

const importBlock = () => {
    const result = prompt("가져올 데이터를 입력하세요.", `예시: {"NICK":[],"ID":[],"IP":[],"TITLE":[],"TEXT":[],"COMMENT":[],"DCCON":[],"TAB":[],"IMAGE":[]}`);

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

const version = ref(
    process.env.NODE_ENV === "development"
        ? `${browser.runtime.getManifest().version}-dev`
        : browser.runtime.getManifest().version
);

const open = (url: string) => {
    browser.tabs.create({url});
};

const openShortcutSettings = () => {
    browser.tabs.create({
        url: process.env.PLASMO_BROWSER === "firefox" ? "about:addons" : "chrome://extensions/shortcuts"
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
    tab.value = 4;

    nextTick(() => {
        const $el = $("#refresher-app");

        for (const element of $el.find(".refresher-module.highlight")) {
            $(element).removeClass("highlight");
        }

        for (const element of $el.find(".tab .refresher-module .title")) {
            const $element = $(element);

            if ($element.text() !== moduleName) continue;

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
        }
    });
};

const settingsCount = (obj: Record<string, RefresherSettings>) => {
    if (!obj) return 0;
    return Object.values(obj).filter((v) => !v?.advanced).length;
};

const advancedSettingsCount = (obj: Record<string, RefresherSettings>) => {
    return Object.values(obj).filter((v) => v?.advanced === true).length;
};

// Computed properties for filtered modules
const modulesWithBasicSettings = computed(() => {
    return Object.keys(settings.value).filter(
        (module) => settings.value[module] && settingsCount(settings.value[module]) > 0
    );
});

const modulesWithAdvancedSettings = computed(() => {
    return Object.keys(settings.value).filter(
        (module) => settings.value[module] && advancedSettingsCount(settings.value[module]) > 0
    );
});

const updateUserSetting = async (module: string, key: string, value: unknown) => {
    settings.value[module][key].value = value;

    try {
        await sendToBackground({
            name: "store",
            body: {
                action: "update",
                type: "userSetting",
                data: {
                    name: module,
                    key,
                    value
                }
            }
        });

        await sendToBackground({
            name: "broadcast",
            body: {
                type: "updateSettingValue",
                data: {
                    name: module,
                    key,
                    value
                }
            }
        });
    } catch (e) {
        console.error("Failed to update user setting:", e);
    }
};

const syncBlock = async () => {
    try {
        await sendToBackground({
            name: "store",
            body: {
                action: "update",
                type: "blocks",
                data: {
                    updateBlocks: true,
                    blocks_store: JSON.parse(JSON.stringify(blocks)),
                    blockModes_store: JSON.parse(JSON.stringify(blockModes.value))
                }
            }
        });

        await sendToBackground({
            name: "broadcast",
            body: {
                type: "updateBlocks",
                data: {
                    blocks: JSON.parse(JSON.stringify(blocks)),
                    modes: JSON.parse(JSON.stringify(blockModes.value))
                }
            }
        });
    } catch (error) {
        // Silent error handling
    }
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
const syncMemos = async () => {
    try {
        await sendToBackground({
            name: "store",
            body: {
                action: "update",
                type: "memos",
                data: {
                    updateMemos: true,
                    memos_store: JSON.parse(JSON.stringify(memos))
                }
            }
        });

        await sendToBackground({
            name: "broadcast",
            body: {
                type: "updateMemos",
                data: {
                    memos: JSON.parse(JSON.stringify(memos))
                }
            }
        });
    } catch {
    }
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
const addMemoUser = async (type: RefresherMemoType) => {
    const user = prompt("메모 대상을 입력하세요.");

    if (!user) return;

    try {
        await sendToBackground({
            name: "broadcast",
            body: {
                type: "refresherRequestMemoAsk",
                data: {
                    type,
                    user
                }
            }
        });
    } catch {
    }
};
const editMemoUser = async (type: RefresherMemoType, user: string) => {
    try {
        await sendToBackground({
            name: "broadcast",
            body: {
                type: "refresherRequestMemoAsk",
                data: {
                    type,
                    user
                }
            }
        });
    } catch {
    }
};
const updateIpDatabase = async () => {
    try {
        const [version, ip, ban] = await Promise.all([
            ky.get("https://dcrefresher.green1052.com/data/version").text(),
            ky.get("https://dcrefresher.green1052.com/data/ip.json").json(),
            ky.get("https://dcrefresher.green1052.com/data/ban.json").json()
        ]);

        await Promise.all([
            storage.set("refresher.database.ip", ip),
            storage.set("refresher.database.ban", ban),
            storage.set("refresher.database.version", version),
            storage.set("refresher.database.lastUpdate", Date.now())
        ]);

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
    background: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans CJK KR", Roboto, Oxygen, Ubuntu, Cantarell,
    "Open Sans", "Helvetica Neue", sans-serif;
    overflow: hidden;

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
        font-size: 100%;
        margin-left: 5%;
        margin-right: 5%;
        overflow: hidden;

        width: 90%;
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
        margin-bottom: 5%;
        margin-right: 3px;
        padding: 4px 8px;
        position: relative;
        z-index: 3;

        & > h3 {
            border-radius: 13.3px;
            cursor: pointer;

            display: flex;
            font-size: 20px;
            margin: 15px auto 20px 15px;
            z-index: 5;

            &:hover {
                opacity: 0.8;
            }

            &:active {
                opacity: 0.7;
            }

            svg {
                margin-bottom: auto;
                margin-left: 5px;
                margin-top: auto;
            }
        }

        .refresher-setting {
            display: flex;
            margin-bottom: 15px;
            margin-left: auto;
            margin-right: auto;
            position: relative;
            width: 95%;

            .info {
                transition: transform 0.24s cubic-bezier(0.19, 1, 0.22, 1);
            }

            .info,
            .control {
                transform: translateX(0px);
            }

            .info::before {
                background-color: rgb(250, 200, 60);
                content: " ";
                height: 100%;
                left: -12px;
                opacity: 0;
                position: absolute;
                transition: opacity 0.15s cubic-bezier(0.19, 1, 0.22, 1);
                width: 4px;
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
                display: block;
                flex: 8;
                margin-right: 15px;

                h4 {
                    font-size: 16px;
                    font-weight: 500;
                }

                p {
                    color: rgb(109, 109, 109);
                    font-size: 14px;
                }

                .mute {
                    color: rgb(177, 177, 177);
                    font-size: 12px;
                }
            }

            .control {
                display: flex;
                flex: 2;
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
                    border-radius: 9px;
                    color: black;
                    font-size: 15px;
                    padding: 4px 16px;
                }
            }
        }
    }

    .refresher-options {
        border: 1px solid #ccc;
        border-radius: 4px;
        display: inline-block;
        font-size: 15px;
        height: 25px;
        overflow: hidden;
        position: relative;
        width: 150px;
    }

    .tab {
        height: 85%;
        margin-top: 30px;
        overflow: auto;
        padding-top: 40px;
        position: absolute;
        width: 99%;

        & > *:first-child {
            margin-top: 5px;
        }
    }

    .refresher-title-zone {
        background: linear-gradient(
                to bottom,
                rgba(255, 255, 255, 1),
                rgba(255, 255, 255, 1),
                rgba(255, 255, 255, 1),
                rgba(255, 255, 255, 0.9),
                rgba(255, 255, 255, 0.6),
                rgba(255, 255, 255, 0)
        );
        display: flex;
        left: 0;
        margin-bottom: 10px;
        margin-top: 10px;
        padding: 0 7.5vw 2vh 7.5vw;
        position: fixed;
        width: 90%;
        z-index: 10;

        h1 {
            margin-bottom: auto;
            margin-top: auto;
        }

        .float-right {
            display: flex;
            margin-left: auto;

            margin-right: 2.5vw;

            p {
                color: #a0a0a0;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                margin: auto;
                padding: 5px 10px;
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
        height: 64px;
        margin: 20px;
        position: relative;
        width: 64px;

        .icon,
        .icon-backdrop {
            position: absolute;
        }
    }

    .icon {
        height: 64px;
        width: 64px;
    }

    .icon-backdrop {
        height: 60px;
        left: 2px;
        right: 2px;
        width: 60px;
    }

    .icon-backdrop {
        animation: refresher-logo-animation 5s infinite;

        filter: saturate(200%) blur(8px);
        z-index: -1;
    }

    .tab1 .info {
        display: flex;
    }

    .tab1 .text {
        display: grid;
        font-size: 16px;

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
            display: flex;
            font-size: 18px;
            margin-bottom: 5px;

            .plus,
            .remove {
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                margin-bottom: auto;
                margin-left: 5px;
                margin-top: auto;
                transition: 0.25s all cubic-bezier(0.19, 1, 0.22, 1);

                &:hover {
                    background-color: #eaeaea;
                }
            }
        }

        .gallery {
            color: #7a7a7a;
            margin-left: 3px;
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
        color: #2475ee;
        cursor: pointer;
        margin-right: 5px;
        text-decoration: none;
        transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);
    }

    a:hover {
        color: #33a3ee;
    }

    a:active {
        color: #33b9ee;
    }

    a::after {
        border-radius: 50%;
        content: "•";
        margin-left: 5px;
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
                        color: rgb(190, 190, 190);
                        font-size: 14px;
                    }

                    .mute {
                        color: rgb(100, 100, 100);
                        font-size: 12px;
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
    border-radius: 13.3px;
    display: flex;

    margin-bottom: 5px;
    padding: 13px 23px;

    position: relative;

    &.highlight {
        animation: highlight-blink 1s;
    }

    .left {
        letter-spacing: -0.66px;

        .title {
            font-size: 18px;
            font-weight: bold;
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
        margin-bottom: auto;
        margin-left: auto;
        margin-top: auto;
    }
}

.refresher-no-modules {
    margin-left: 15px;
    margin-top: 160px;

    h3 {
        color: #a0a0a0;
        font-size: 28px;
        letter-spacing: -2.66px;
        line-height: 1;
    }

    p {
        font-size: 16px;
        font-weight: bold;
    }
}

.shortcut-lists {
    margin-bottom: 20px;
}

.refresher-shortcut {
    border-radius: 13.3px;
    display: flex;
    margin-bottom: 5px;
    padding: 8px 16px;

    .key {
        display: flex;
        margin-left: auto;

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

.block-dialog-backdrop {
    align-items: center;
    animation: backdrop-fade-in 0.3s ease-out;
    backdrop-filter: blur(2px);
    background-color: rgba(0, 0, 0, 0.6);
    bottom: 0;
    box-sizing: border-box;
    display: flex;
    height: 100vh;
    justify-content: center;
    left: 0;
    overflow-y: auto;
    padding: 20px;
    position: fixed;
    right: 0;
    top: 0;
    width: 100vw;
    z-index: 999999;
}

.block-dialog-content {
    animation: dialog-slide-in 0.3s ease-out;
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    flex-shrink: 0;
    margin: auto;
    max-height: calc(100vh - 40px);
    max-width: 500px;
    overflow-y: auto;
    padding: 32px;
    position: relative;
    width: 100%;

    .head {
        border-bottom: 2px solid #f8f9fa;
        color: #2c3e50;
        font-size: 22px;
        font-weight: 700;
        margin-bottom: 28px;
        padding-bottom: 16px;
        text-align: center;
    }

    .memo-row {
        margin-bottom: 24px;

        > p {
            color: #343a40;
            display: block;
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 10px;
        }
    }

    .button-wrap {
        border-top: 1px solid #f1f3f4;
        cursor: pointer;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 32px;
        padding-top: 20px;
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
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        color: #ffffff;

        .head {
            border-bottom-color: #2f3349;
            color: #ffffff;
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

.refresher-slide-left-enter-active {
    transition: all 450ms cubic-bezier(0.19, 1, 0.22, 1);
}

.refresher-slide-left-leave-active {
    display: none;
}

.refresher-slide-left-enter,
.refresher-slide-left-leave-to {
    opacity: 0;
    position: absolute;
    transform: translateX(10px);
}

.refresher-slide-left-enter-to {
    opacity: 1;
    transform: translateX(0px);
}
</style>
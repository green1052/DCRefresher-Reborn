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
              v-model:value="blockFormData.content"
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
              v-model:value="blockFormData.gallery"
              :change="(a, b, value) => (blockFormData.gallery = value)"
              placeholder="갤러리 ID"
          />
        </div>

        <div class="memo-row">
          <p>차단 모드</p>

          <refresher-options
              v-model:value="blockFormData.mode"
              :change="(a, b, value: string) => (blockFormData.mode = value as RefresherBlockDetectMode | 'NONE')"
              :options="{ NONE: '기본값', ...blockDetectModeTypeNames }"
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
            v-for="tabItem in tabs"
            :key="tabItem.id"
            :class="{ active: tab === tabItem.id }"
            @click="() => (tab = tabItem.id)"
        >
          {{ tabItem.label }}
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
                :src="browser.runtime.getURL((browser.runtime.getManifest().icons?.[128] ?? 'icon-128.png') as never)"
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
                                    class="clickable-icon"
                                    height="12px"
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
          <div v-if="!hasSettings">
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
        <div v-if="!hasSettings">
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
        <div class="section-header">
          <h2>데이터 관리</h2>

          <div class="section-actions">
            <button @click="exportBlock">내보내기</button>
            <button @click="importBlock">가져오기</button>
          </div>

          <br/>
          <br/>

          <h2>차단 모드</h2>

          <div
              v-for="key in blockTypes"
              class="mode-row"
          >
            <label>{{ blockKeyNames[key] }}:</label>
            <select
                v-model="blockModes[key]"
                @change="editBlockMode"
            >
              <option
                  v-for="[key2, value2] in Object.entries(blockDetectModeTypeNames)"
                  :value="key2"
              >
                {{ value2 }}
              </option>
            </select>
          </div>
        </div>
        <div
            v-for="key in blockTypes"
            class="block-divide"
        >
          <h3>
            {{ blockKeyNames[key] }} ({{ blocks[key].length }}개)

            <span
                class="plus"
                @click="() => openBlockDialog(key)"
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
                :image="`https://image.dcinside.com/dccon.php?no=${blocked.isRegex ? (blocked.content.match(/^\^\((\w*)\|/)?.at(1) ?? blocked.content) : blocked.content}`"
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
        <div class="section-header">
          <h2>데이터 관리</h2>

          <div class="section-actions">
            <button @click="exportMemo">내보내기</button>
            <button @click="importMemo">가져오기</button>
            <button @click="open('https://dcrefresher.green1052.com/utils/convert-memo')">메모 변환</button>
          </div>

          <br/>
        </div>

        <div
            v-for="key in memoTypes"
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
            v-if="!hasModules"
            class="refresher-no-modules"
        >
          <h3>로드된 모듈 없음</h3>
          <p>우선 디시 페이지를 열어주세요.</p>
        </div>
        <div v-else>
          <refresher-module
              v-for="module in modules"
              :key="module.name"
              :desc="module.description ?? ''"
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
              :key="shortcut.name"
          >
            <div
                v-if="shortcut.description?.length"
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
        <p class="shortcut-settings-link"><a @click="openShortcutSettings">단축키 설정</a></p>
      </div>
    </transition-group>
  </div>
</template>

<script lang="ts" setup>
import {Browser} from "#imports";
import {sendMessage} from "@/utils/messaging";
import {
  BLOCK_TYPES,
  blockModeStorage,
  blockStorage,
  MEMO_TYPES,
  memoStorage,
  modulesStorage,
  type ModuleState,
  settingsStorage
} from "@/utils/storage";
import {writeClipboard} from "@/utils/writeClipboard";
import ky from "@/utils/httpClient";
import {computed, nextTick, onMounted, reactive, ref} from "vue";

import {BLOCK_DETECT_MODE_TYPE_NAMES, BlockModeCache, TYPE_NAMES as BLOCK_TYPE_NAMES} from "../../core/block";
import {TYPE_NAMES as MEMO_TYPE_NAMES} from "../../core/memo";
import storage from "../../utils/webStorage";

import RefresherBubble from "./components/bubble.vue";
import RefresherCheckbox from "./components/checkbox.vue";
import RefresherModule from "./components/module.vue";
import RefresherOptions from "./components/options.vue";
import RefresherInput from "./components/refresherInput.vue";
import SettingsModule from "./components/settingsModule.vue";

const tab = ref(0);
const modules = ref<Record<string, ModuleState>>({});
const settings = ref<{ [key: string]: { [key: string]: RefresherSettings } }>({});
const tabs = [
  {id: 0, label: "일반"},
  {id: 1, label: "고급"},
  {id: 2, label: "차단"},
  {id: 3, label: "메모"},
  {id: 4, label: "모듈"},
  {id: 5, label: "단축키"}
] as const;
const shortcuts = ref<Browser.commands.Command[]>([]);
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
const blockModes = ref<Partial<BlockModeCache>>({});
const blockDetectModeTypeNames = BLOCK_DETECT_MODE_TYPE_NAMES;
const memos = reactive<{ [key in RefresherMemoType]: { [key: string]: RefresherMemoValue } }>({
  UID: {},
  NICK: {},
  IP: {}
});
const memoKeyNames = MEMO_TYPE_NAMES;
const blockKeyNames = BLOCK_TYPE_NAMES;
const blockTypes = BLOCK_TYPES;
const memoTypes = MEMO_TYPES;
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
const blockFormData = reactive<{
  content: string;
  isRegex: boolean;
  gallery: string;
  mode: RefresherBlockDetectMode | "NONE";
}>({
  content: "",
  isRegex: false,
  gallery: "",
  mode: "NONE"
});

const copyToClipboard = async (payload: unknown) => {
  try {
    await writeClipboard(JSON.stringify(payload));
    alert("클립보드에 복사되었습니다.");
  } catch {
    alert("클립보드에 복사하지 못했습니다.");
  }
};

const parseImportData = (example: string) => {
  const result = prompt("가져올 데이터를 입력하세요.", example);
  if (!result) return null;

  try {
    const parsed = JSON.parse(result) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("가져오기 데이터는 JSON 객체여야 합니다.");
    }

    return parsed as Record<string, unknown>;
  } catch {
    alert("데이터가 잘못됐습니다.");
    return null;
  }
};

const isBlockImportValue = (value: unknown): value is RefresherBlockValue => {
  if (!value || typeof value !== "object") return false;

  const blockValue = value as Partial<RefresherBlockValue>;
  return (
      typeof blockValue.content === "string" &&
      typeof blockValue.isRegex === "boolean" &&
      typeof blockValue.isAdvanced === "boolean" &&
      (blockValue.gallery === undefined || typeof blockValue.gallery === "string") &&
      (blockValue.extra === undefined || typeof blockValue.extra === "string") &&
      (blockValue.mode === undefined || Object.hasOwn(blockDetectModeTypeNames, blockValue.mode))
  );
};

const normalizeBlockImportList = (value: unknown): RefresherBlockValue[] => {
  if (typeof value === "string") {
    try {
      return normalizeBlockImportList(JSON.parse(value));
    } catch {
      return [];
    }
  }

  return Array.isArray(value) ? value.filter(isBlockImportValue) : [];
};

const normalizeBlockModeValue = (value: unknown): RefresherBlockDetectMode | undefined => {
  if (typeof value !== "string") return;
  if (Object.hasOwn(blockDetectModeTypeNames, value)) return value as RefresherBlockDetectMode;

  try {
    return normalizeBlockModeValue(JSON.parse(value));
  } catch {
    return;
  }
};

const isMemoImportValue = (value: unknown): value is RefresherMemoValue => {
  if (!value || typeof value !== "object") return false;

  const memoValue = value as Partial<RefresherMemoValue>;
  return (
      typeof memoValue.text === "string" &&
      typeof memoValue.color === "string" &&
      (memoValue.gallery === undefined || typeof memoValue.gallery === "string")
  );
};

const normalizeMemoImportMap = (value: unknown): Record<string, RefresherMemoValue> => {
  if (typeof value === "string") {
    try {
      return normalizeMemoImportMap(JSON.parse(value));
    } catch {
      return {};
    }
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(Object.entries(value).filter(([, memo]) => isMemoImportValue(memo)));
};

const closeBlockDialog = () => {
  showBlockDialog.value = false;
};

const openBlockDialog = (type: RefresherBlockType) => {
  currentBlockType.value = type;
  blockFormData.content = "";
  blockFormData.isRegex = false;
  blockFormData.gallery = "";
  blockFormData.mode = "NONE";
  showBlockDialog.value = true;
};

onMounted(async () => {
  try {
    // Load initial data for blocks and memos directly from storage
    for (const type of BLOCK_TYPES) {
      blocks[type] = normalizeBlockImportList(await blockStorage[type].getValue());
      const mode = normalizeBlockModeValue(await blockModeStorage[type].getValue());
      if (mode) blockModes.value[type] = mode;

      // Watch for changes
      blockStorage[type].watch((newValue) => {
        blocks[type] = normalizeBlockImportList(newValue);
      });
      blockModeStorage[type].watch((newValue) => {
        const mode = normalizeBlockModeValue(newValue);
        if (mode) blockModes.value[type] = mode;
      });
    }

    for (const type of MEMO_TYPES) {
      memos[type] = normalizeMemoImportMap(await memoStorage[type].getValue());

      // Watch for changes
      memoStorage[type].watch((newValue) => {
        memos[type] = normalizeMemoImportMap(newValue);
      });
    }

    const initialModules = await modulesStorage.getValue();
    const initialSettings = await settingsStorage.getValue();

    if (initialModules) modules.value = initialModules;
    if (initialSettings) settings.value = initialSettings;

    modulesStorage.watch((newValue) => {
      if (newValue) modules.value = newValue;
    });

    settingsStorage.watch((newValue) => {
      if (newValue) settings.value = newValue;
    });
  } catch (e) {
    console.error("Failed to load initial data", e);
  }

  shortcuts.value = await browser.commands.getAll();
  databaseVersion.value = await storage.get("refresher.database.version");
});

const exportMemo = () => copyToClipboard(memos);

const importMemo = async () => {
  const data = parseImportData(`예시: {"UID":{},"NICK":{},"IP":{}}`);
  if (!data) return;

  for (const [key, value] of Object.entries(data)) {
    if (!(memoTypes as readonly string[]).includes(key)) continue;

    const type = key as RefresherMemoType;
    const target = memos[type];
    const importedMemos = normalizeMemoImportMap(value);

    for (const [id, memo] of Object.entries(importedMemos)) {
      if (target[id] && !confirm(`${id}에 대한 메모가 이미 존재합니다. 덮어쓰시겠습니까?`)) {
        continue;
      }

      target[id] = memo;
    }

    await memoStorage[type].setValue({...target});
  }

  alert("가져오기에 성공했습니다.");
};

const exportBlock = () => copyToClipboard(blocks);

const importBlock = async () => {
  const data = parseImportData(`예시: {"NICK":[],"ID":[],"IP":[],"TITLE":[],"TEXT":[],"COMMENT":[],"DCCON":[],"TAB":[],"IMAGE":[]}`);
  if (!data) return;

  for (const [key, value] of Object.entries(data)) {
    if (!(blockTypes as readonly string[]).includes(key)) continue;

    const type = key as RefresherBlockType;
    const target = normalizeBlockImportList(blocks[type]);
    if (!Array.isArray(value)) continue;

    blocks[type] = target;

    for (const block of normalizeBlockImportList(value)) {
      if (
          target.some((v) => v.content === block.content) &&
          !confirm(`${block.content}가 이미 존재합니다. 추가하시겠습니까?`)
      ) {
        continue;
      }

      target.push(block);
    }

    await blockStorage[type].setValue(target);
  }

  alert("가져오기에 성공했습니다.");
};

const version = ref(
    import.meta.env.DEV
        ? `${browser.runtime.getManifest().version}-dev`
        : browser.runtime.getManifest().version
);

const open = (url: string) => {
  browser.tabs.create({url});
};

const openShortcutSettings = () => {
  browser.tabs.create({
    url: (import.meta.env.FIREFOX as boolean) ? "about:addons" : "chrome://extensions/shortcuts"
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
    const app = document.querySelector<HTMLElement>("#refresher-app");
    if (!app) return;

    for (const element of app.querySelectorAll<HTMLElement>(".refresher-module.highlight")) {
      element.classList.remove("highlight");
    }

    for (const element of app.querySelectorAll<HTMLElement>(".tab .refresher-module .title")) {
      if (element.textContent !== moduleName) continue;

      element.parentElement?.parentElement?.classList.add("highlight");

      element.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      setTimeout(() => {
        for (const el of app.querySelectorAll<HTMLElement>(".refresher-module.highlight")) {
          el.classList.remove("highlight");
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
const hasSettings = computed(() => Object.keys(settings.value).length > 0);
const hasModules = computed(() => Object.keys(modules.value).length > 0);

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

const updateUserSetting = async (module: string | undefined, key: string | undefined, value: unknown) => {
  if (!module || !key) return;
  const setting = settings.value[module]?.[key];
  if (!setting) return;

  const previousValue = setting.value;
  (setting.value as unknown) = value;
  let currentSettings: Record<string, Record<string, RefresherSettings>> | null = null;

  try {
    await storage.set(`${module}.${key}`, value);

    currentSettings = await settingsStorage.getValue();
    if (currentSettings && currentSettings[module] && currentSettings[module][key]) {
      (currentSettings[module][key].value as unknown) = value;
      await settingsStorage.setValue(currentSettings);
    }

    await sendMessage("broadcast", {
      type: "updateSettingValue",
      data: {
        name: module,
        key,
        value
      }
    });
  } catch (e) {
    (setting.value as unknown) = previousValue;

    try {
      await storage.set(`${module}.${key}`, previousValue);

      if (currentSettings?.[module]?.[key]) {
        (currentSettings[module][key].value as unknown) = previousValue;
        await settingsStorage.setValue(currentSettings);
      }
    } catch (rollbackError) {
      console.error("Failed to rollback user setting:", rollbackError);
    }

    console.error("Failed to update user setting:", e);
  }
};

const confirmAddBlock = async () => {
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

  await blockStorage[currentBlockType.value].setValue([...blocks[currentBlockType.value]]);
  closeBlockDialog();
};

const removeBlockedUser = async (key: RefresherBlockType, index: number) => {
  blocks[key].splice(index, 1);
  await blockStorage[key].setValue([...blocks[key]]);
};
const removeAllBlockedUser = async (key: RefresherBlockType) => {
  if (!confirm(`${blockKeyNames[key]} 차단 목록을 모두 삭제할까요?`)) return;
  blocks[key] = [];
  await blockStorage[key].setValue([]);
};
const editBlockedUser = async (key: RefresherBlockType, index: number) => {
  if (key === "DCCON") {
    alert("디시콘 수정은 아직 지원하지 않습니다, 우클릭 메뉴를 이용해주세요.");
    return;
  }

  const result = prompt(`바꿀 ${blockKeyNames[key]} 값을 입력하세요.`);

  if (!result) return;

  blocks[key][index].content = result;
  await blockStorage[key].setValue([...blocks[key]]);
};
const editBlockMode = async () => {
  for (const type of BLOCK_TYPES) {
    const mode = blockModes.value[type];
    if (mode) await blockModeStorage[type].setValue(mode);
  }
};

const removeMemoUser = async (type: RefresherMemoType, user: string) => {
  delete memos[type][user];
  await memoStorage[type].setValue(memos[type]);
};
const removeAllMemoUser = async (type: RefresherMemoType) => {
  if (!confirm(`${memoKeyNames[type]} 메모를 모두 삭제할까요?`)) return;
  memos[type] = {};
  await memoStorage[type].setValue({});
};
const requestMemoAsk = async (type: RefresherMemoType, user: string) => {
  try {
    await sendMessage("broadcast", {
      type: "refresherRequestMemoAsk",
      data: {
        type,
        user
      }
    });
  } catch {
  }
};

const addMemoUser = async (type: RefresherMemoType) => {
  const user = prompt("메모 대상을 입력하세요.");

  if (!user) return;

  await requestMemoAsk(type, user);
};
const editMemoUser = async (type: RefresherMemoType, user: string) => {
  await requestMemoAsk(type, user);
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

<style lang="scss" src="./popup.scss"></style>

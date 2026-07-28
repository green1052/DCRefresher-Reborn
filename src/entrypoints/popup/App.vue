<template>
    <div id="refresher-app" :class="{ 'options-page': optionsPage }">
        <BlockDialog
            :block-detect-mode-type-names="blockDetectModeTypeNames"
            :block-key-names="blockKeyNames"
            :current-block-type="currentBlockType"
            :form-data="blockFormData"
            :visible="showBlockDialog"
            @close="closeBlockDialog"
            @confirm="confirmAddBlock"
        />

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
            <button
                v-if="!optionsPage"
                class="open-options-btn"
                title="전체 설정 페이지 열기"
                @click="openOptions"
            >
                <ExternalLink :size="14"/>
            </button>
        </div>

        <transition-group name="refresher-slide-left">
            <GeneralTab
                v-if="tab === 0"
                key="tab1"
            />
            <BlockTab
                v-else-if="tab === 1"
                key="tab2"
            />
            <MemoTab
                v-else-if="tab === 2"
                key="tab3"
            />
            <ModuleTab
                v-else-if="tab === 3"
                key="tab4"
            />
            <ShortcutTab
                v-else-if="tab === 4"
                key="tab5"
            />
            <DataTab
                v-else-if="tab === 5"
                key="tab6"
            />
        </transition-group>
    </div>
</template>

<script lang="ts" setup>
import {provide, ref} from "vue";

import {ExternalLink} from "lucide-vue-next";
import BlockDialog from "./components/BlockDialog.vue";
import GeneralTab from "./tabs/GeneralTab.vue";
import BlockTab from "./tabs/BlockTab.vue";
import MemoTab from "./tabs/MemoTab.vue";
import ModuleTab from "./tabs/ModuleTab.vue";
import ShortcutTab from "./tabs/ShortcutTab.vue";
import DataTab from "./tabs/DataTab.vue";

import {useBlocks} from "./composables/useBlocks";
import {useMemos} from "./composables/useMemos";
import {useSettings} from "./composables/useSettings";
import {useData} from "./composables/useData";

defineProps<{ optionsPage?: boolean }>();

const tab = ref(0);
const tabs = [
    {id: 0, label: "일반"},
    {id: 1, label: "차단"},
    {id: 2, label: "메모"},
    {id: 3, label: "모듈"},
    {id: 4, label: "단축키"},
    {id: 5, label: "데이터"}
] as const;

const blocksComposable = useBlocks();
const memosComposable = useMemos();
const settingsComposable = useSettings();
const dataComposable = useData();

const {
    blockKeyNames,
    blockDetectModeTypeNames,
    currentBlockType,
    blockFormData,
    showBlockDialog,
    closeBlockDialog,
    confirmAddBlock
} = blocksComposable;

const {moveToModuleTab: moveToModuleTabRaw} = settingsComposable;

const moveToModuleTab = (moduleName: string) => {
    tab.value = 3;
    moveToModuleTabRaw(moduleName);
};

provide("blocks", blocksComposable);
provide("memos", memosComposable);
provide("settings", settingsComposable);
provide("data", dataComposable);
provide("updateUserSetting", settingsComposable.updateUserSetting);
provide("typeWrap", settingsComposable.typeWrap);
provide("moveToModuleTab", moveToModuleTab);

const openOptions = () => {
    browser.runtime.openOptionsPage();
};
</script>

<style lang="scss" src="./popup.scss"></style>
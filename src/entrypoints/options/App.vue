<template>
  <div id="refresher-app" class="options-page">
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

import BlockDialog from "../popup/components/BlockDialog.vue";
import GeneralTab from "../popup/tabs/GeneralTab.vue";
import BlockTab from "../popup/tabs/BlockTab.vue";
import MemoTab from "../popup/tabs/MemoTab.vue";
import ModuleTab from "../popup/tabs/ModuleTab.vue";
import ShortcutTab from "../popup/tabs/ShortcutTab.vue";
import DataTab from "../popup/tabs/DataTab.vue";

import {useBlocks} from "../popup/composables/useBlocks";
import {useMemos} from "../popup/composables/useMemos";
import {useSettings} from "../popup/composables/useSettings";
import {useData} from "../popup/composables/useData";

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
  tab.value = 4;
  moveToModuleTabRaw(moduleName);
};

provide("blocks", blocksComposable);
provide("memos", memosComposable);
provide("settings", settingsComposable);
provide("data", dataComposable);
provide("updateUserSetting", settingsComposable.updateUserSetting);
provide("typeWrap", settingsComposable.typeWrap);
provide("moveToModuleTab", moveToModuleTab);
</script>

<style lang="scss" src="../popup/popup.scss"></style>

<style lang="scss">
/* options 페이지 전용 - popup 고정 크기/위치 제거 */
html, body {
  height: auto;
  min-height: 100vh;
  overflow-y: auto;
  margin: 0;
  padding: 0;
}

#refresher-app.options-page {
  width: 100% !important;
  height: auto !important;
  min-height: 100vh;
  max-width: none !important;
  margin: 0 !important;
  border-radius: 0 !important;
  overflow: visible;
  display: block;

  .refresher-title-zone {
    position: relative !important;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 10px 24px;
    box-sizing: border-box;
    z-index: auto;
  }

  .tab {
    position: relative !important;
    width: 100% !important;
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px 24px 40px;
    height: auto !important;
    box-sizing: border-box;
    overflow-y: visible;
  }
}
</style>
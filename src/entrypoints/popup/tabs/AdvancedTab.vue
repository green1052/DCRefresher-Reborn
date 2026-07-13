<template>
  <div class="tab tab1">
    <div v-if="!hasSettings">
      <h3 class="need-refresh">우선 디시인사이드 페이지를 열고 설정 해주세요.</h3>
    </div>
    <div v-else>
      <settings-module
          v-for="moduleName in modulesWithAdvancedSettings"
          :key="moduleName"
          :module-enabled="modules[moduleName]?.enable ?? false"
          :module-name="moduleName"
          :module-settings="settings[moduleName]"
          :show-advanced="true"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import {inject} from "vue";
import SettingsModule from "../components/settingsModule.vue";

const {
  modules,
  settings,
  hasSettings,
  modulesWithAdvancedSettings
} = inject("settings")!;
</script>
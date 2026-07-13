<template>
  <div
      :data-changed="setting.value !== setting.default"
      class="refresher-setting"
  >
    <div class="info">
      <h4>{{ setting.name }}</h4>
      <p>{{ setting.desc }}</p>
      <p class="mute">(기본 값 : {{ typeWrap(setting.default) }})</p>
    </div>

    <setting-control
        :module-enabled="moduleEnabled"
        :module-name="moduleName"
        :setting="setting"
        :setting-key="settingKey"
    />
  </div>
</template>

<script lang="ts" setup>
import {inject} from "vue";
import SettingControl from "./settingControl.vue";

interface Props {
  setting: RefresherSettings;
  settingKey: string;
  moduleName: string;
  moduleEnabled: boolean;
}

defineProps<Props>();

const typeWrap = inject<(value: unknown) => string | unknown>("typeWrap")!;
</script>
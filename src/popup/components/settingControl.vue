<template>
  <div class="control">
    <refresher-checkbox
        v-if="setting.type === 'check'"
        :id="settingKey"
        :change="updateUserSetting"
        :checked="setting.value"
        :disabled="!moduleEnabled"
        :modname="moduleName"
    />
    <refresher-input
        v-else-if="setting.type === 'text'"
        :id="settingKey"
        :change="updateUserSetting"
        :disabled="!moduleEnabled"
        :modname="moduleName"
        :placeholder="setting.default"
        :value="setting.value"
    />
    <refresher-range
        v-else-if="setting.type === 'range'"
        :id="settingKey"
        :change="updateUserSetting"
        :disabled="!moduleEnabled"
        :max="setting.max"
        :min="setting.min"
        :modname="moduleName"
        :placeholder="setting.default"
        :step="setting.step"
        :unit="setting.unit"
        :value="Number(setting.value)"
    />
    <refresher-options
        v-else-if="setting.type === 'option'"
        :id="settingKey"
        :change="updateUserSetting"
        :disabled="!moduleEnabled"
        :modname="moduleName"
        :options="setting.items"
        :value="setting.value"
    />
  </div>
</template>

<script lang="ts" setup>
import RefresherCheckbox from "./checkbox.vue";
import RefresherOptions from "./options.vue";
import RefresherRange from "./range.vue";
import RefresherInput from "./refresherInput.vue";

interface Props {
  setting: RefresherSettings;
  settingKey: string;
  moduleName: string;
  moduleEnabled: boolean;
  updateUserSetting: (module: string, key: string, value: unknown) => void;
}

defineProps<Props>();
</script>
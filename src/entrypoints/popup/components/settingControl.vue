<template>
  <div class="control">
    <refresher-checkbox
        v-if="setting.type === 'check'"
        :id="settingKey"
        :change="updateUserSettingAdapter"
        :checked="setting.value"
        :disabled="!moduleEnabled"
        :modname="moduleName"
    />
    <refresher-input
        v-else-if="setting.type === 'text'"
        :id="settingKey"
        :change="updateUserSettingAdapter"
        :disabled="!moduleEnabled"
        :modname="moduleName"
        :placeholder="setting.default"
        :value="setting.value"
    />
    <refresher-range
        v-else-if="setting.type === 'range'"
        :id="settingKey"
        :change="updateUserSettingAdapter"
        :disabled="!moduleEnabled"
        :max="setting.max"
        :min="setting.min"
        :modname="moduleName"
        :placeholder="String(setting.default)"
        :step="setting.step"
        :unit="setting.unit"
        :value="Number(setting.value)"
    />
    <refresher-options
        v-else-if="setting.type === 'option'"
        :id="settingKey"
        :change="updateUserSettingAdapter"
        :disabled="!moduleEnabled"
        :modname="moduleName"
        :options="setting.items as Record<string, string>"
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
  updateUserSetting: (module: string | undefined, key: string | undefined, value: unknown) => void;
}

const props = defineProps<Props>();

const updateUserSettingAdapter = (module: string | undefined, id: string | undefined, value: unknown) => {
  props.updateUserSetting(module, id, value);
};
</script>
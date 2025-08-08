<template>
    <div
        :data-changed="setting.value !== setting.default"
        class="refresher-setting"
    >
        <div class="info">
            <h4>{{ setting.name }}</h4>
            <p>{{ setting.desc }}</p>
            <p class="mute">
                (기본 값 : {{ typeWrap(setting.default) }})
            </p>
        </div>

        <setting-control
            :setting="setting"
            :setting-key="settingKey"
            :module-name="moduleName"
            :module-enabled="moduleEnabled"
            :update-user-setting="updateUserSetting"
        />
    </div>
</template>

<script lang="ts" setup>
import SettingControl from './settingControl.vue';

interface Props {
    setting: RefresherSettings;
    settingKey: string;
    moduleName: string;
    moduleEnabled: boolean;
    updateUserSetting: (module: string, key: string, value: unknown) => void;
    typeWrap: (value: unknown) => string | unknown;
}

defineProps<Props>();
</script>
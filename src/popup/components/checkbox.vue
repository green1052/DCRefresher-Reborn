<template>
    <div
        :class="{ disabled }"
        :data-id="id"
        :data-module="modname"
        :data-on="isOn"
        class="refresher-checkbox"
        @click="toggle"
    >
        <div
            :style="transformStyle"
            class="selected"
            @pointerdown="handlePointerDown"
            @pointermove="handlePointerMove"
            @pointerout="handlePointerOut"
            @pointerup="handlePointerUp"
        />
    </div>
</template>

<script lang="ts" setup>
import { computed, getCurrentInstance, ref, toRefs, watch } from "vue";

interface Props {
    change?: (module: string | undefined, id: string | undefined, value: boolean) => void;
    modname?: string;
    id?: string;
    checked?: boolean;
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    checked: false,
    disabled: false
});

const { checked, disabled } = toRefs(props);
const instance = getCurrentInstance();
const isOn = ref(checked.value);
const isDown = ref(false);
const translateX = ref<number | undefined>(undefined);
const onceOut = ref(false);

watch(checked, (newValue) => {
    isOn.value = newValue;
});

const transformStyle = computed(() => ({
    transform: `translateX(${translateX.value ?? (isOn.value ? 18 : 0)}px)`
}));

const toggle = () => {
    if (disabled.value) return;

    if (onceOut.value) {
        onceOut.value = false;
        return;
    }

    isOn.value = !isOn.value;
    const el = instance?.proxy?.$el as HTMLElement;
    props.change?.(el?.dataset.module, el?.dataset.id, isOn.value);
};

const handlePointerMove = (ev: PointerEvent) => {
    if (disabled.value || !isDown.value) return;
    translateX.value = Math.max(0, Math.min(18, Math.ceil(ev.offsetX)));
};

const handlePointerDown = () => {
    if (!disabled.value) isDown.value = true;
};

const handlePointerUp = () => {
    if (disabled.value) return;
    isDown.value = false;
    translateX.value = undefined;
};

const handlePointerOut = () => {
    if (disabled.value || !isDown.value) return;
    isDown.value = false;
    translateX.value = undefined;
    toggle();
    onceOut.value = true;
};
</script>

<style lang="scss" scoped>
.refresher-checkbox {
    position: relative;
    cursor: pointer;
    display: flex;
    width: 38px;
    height: 20px;
    border-radius: 25px;
    transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
    background-color: #e0e0e0;

    &[data-on="true"] {
        background-color: #4caf50;
    }

    &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .selected {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        transition: transform 0.25s cubic-bezier(0.19, 1, 0.22, 1);
        cursor: grab;

        &:active {
            cursor: grabbing;
        }
    }

    &:hover:not(.disabled) {
        transform: scale(1.05);
    }

    &:active:not(.disabled) {
        transform: scale(0.95);
    }
}

@media (prefers-color-scheme: dark) {
    .refresher-checkbox {
        background-color: #555;

        &[data-on="true"] {
            background-color: #66bb6a;
        }

        .selected {
            background-color: #f5f5f5;
            box-shadow: 0 2px 4px rgba(255, 255, 255, 0.1);
        }
    }
}
</style>

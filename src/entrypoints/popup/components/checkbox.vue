<template>
    <div
        :class="{ disabled }"
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
import {computed, ref, watch} from "vue";

interface Props {
    modelValue?: boolean;
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: false,
    disabled: false
});

const emit = defineEmits<{
    "update:modelValue": [value: boolean];
    change: [value: boolean];
}>();

const isOn = ref(props.modelValue);
const isDown = ref(false);
const translateX = ref<number | undefined>(undefined);
const onceOut = ref(false);

watch(() => props.modelValue, (newValue) => {
    isOn.value = newValue;
});

const transformStyle = computed(() => ({
    transform: `translateX(${translateX.value ?? (isOn.value ? 18 : 0)}px)`
}));

const toggle = () => {
    if (props.disabled) return;

    if (onceOut.value) {
        onceOut.value = false;
        return;
    }

    isOn.value = !isOn.value;
    emit("update:modelValue", isOn.value);
    emit("change", isOn.value);
};

const handlePointerMove = (ev: PointerEvent) => {
    if (props.disabled || !isDown.value) return;
    translateX.value = Math.max(0, Math.min(18, Math.ceil(ev.offsetX)));
};

const handlePointerDown = () => {
    if (!props.disabled) isDown.value = true;
};

const handlePointerUp = () => {
    if (props.disabled) return;
    isDown.value = false;
    translateX.value = undefined;
};

const handlePointerOut = () => {
    if (props.disabled || !isDown.value) return;
    isDown.value = false;
    translateX.value = undefined;
    toggle();
    onceOut.value = true;
};
</script>

<style lang="scss" scoped>
.refresher-checkbox {
    background-color: #e0e0e0;
    border-radius: 25px;
    cursor: pointer;
    display: flex;
    height: 20px;
    position: relative;
    transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
    width: 38px;

    &[data-on="true"] {
        background-color: #4caf50;
    }

    &.disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }

    .selected {
        background-color: white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        cursor: grab;
        height: 16px;
        left: 2px;
        position: absolute;
        top: 2px;
        transition: transform 0.25s cubic-bezier(0.19, 1, 0.22, 1);
        width: 16px;

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
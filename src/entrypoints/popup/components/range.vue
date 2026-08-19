<template>
    <div class="refresher-range">
        <input
            v-model="currentValue"
            :disabled="disabled"
            :max="max"
            :min="min"
            :placeholder="placeholder"
            :step="step"
            type="range"
            @change="handleChange"
        />
        <span class="indicator">{{ displayValue }}</span>
    </div>
</template>

<script lang="ts" setup>
import {computed, ref, watch} from "vue";

interface Props {
    modelValue?: number;
    placeholder?: string;
    max?: number;
    min?: number;
    step?: number;
    unit?: string;
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    modelValue: 0,
    min: 0,
    max: 100,
    step: 1,
    unit: "",
    disabled: false
});

const emit = defineEmits<{
    "update:modelValue": [value: number];
    change: [value: number];
}>();

const currentValue = ref(props.modelValue);

watch(() => props.modelValue, (v) => {
    currentValue.value = v;
});

const displayValue = computed(() => `${currentValue.value}${props.unit}`);

const handleChange = () => {
    emit("update:modelValue", Number(currentValue.value));
    emit("change", Number(currentValue.value));
};
</script>

<style lang="scss" scoped>
@use "@/assets/styles/variables" as *;

.refresher-range {
    align-items: center;
    display: flex;
    gap: 10px;

    input {
        -webkit-appearance: none;
        appearance: none;
        background: var(--refresher-control-track);
        border-radius: 3px;
        flex: 1;
        height: 6px;
        outline: none;
        transition: background 0.25s $ease-out-expo;

        &::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            background: var(--refresher-green);
            border-radius: 50%;
            cursor: pointer;
            height: 18px;
            transition: all 0.25s $ease-out-expo;
            width: 18px;

            &:hover {
                box-shadow: 0 0 0 4px var(--refresher-green-ring);
                transform: scale(1.1);
            }
        }

        &::-moz-range-thumb {
            background: var(--refresher-green);
            border: none;
            border-radius: 50%;
            cursor: pointer;
            height: 18px;
            transition: all 0.25s $ease-out-expo;
            width: 18px;

            &:hover {
                box-shadow: 0 0 0 4px var(--refresher-green-ring);
                transform: scale(1.1);
            }
        }

        &:disabled {
            cursor: not-allowed;
            opacity: 0.5;

            &::-webkit-slider-thumb {
                cursor: not-allowed;

                &:hover {
                    box-shadow: none;
                    transform: none;
                }
            }

            &::-moz-range-thumb {
                cursor: not-allowed;

                &:hover {
                    box-shadow: none;
                    transform: none;
                }
            }
        }
    }

    .indicator {
        color: var(--refresher-text-tertiary);
        font-size: 12px;
        font-weight: 500;
        min-width: 40px;
        text-align: right;
    }
}

</style>
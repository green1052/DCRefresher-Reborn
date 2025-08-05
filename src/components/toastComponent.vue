<template>
    <transition
        appear
        name="refresher-toast"
    >
        <div
            v-show="open"
            :key="id"
            :class="{ hover: clickCb }"
            :data-type="type"
            :title="content"
            class="refresher-toast"
        >
            <div
                class="contents"
                @click="click"
            >
                <div class="text">
                    <p>{{ content }}</p>
                </div>
                <div
                    class="button"
                    @click="hide"
                >
                    <i class="material-icons">X</i>
                </div>
            </div>
        </div>
    </transition>
</template>

<script lang="ts" setup>
import { ref } from "vue";

const title = ref("");
const id = ref(0);
const content = ref("");
const clickCb = ref<((e: MouseEvent) => void) | null>(null);
const open = ref(false);
const type = ref<"info" | "error" | "warning" | "cake" | null>(null);
const autoClose = ref(0);

const click = (e: MouseEvent) => {
    if (clickCb.value) {
        clickCb.value(e);
    }
};

const update = (newContent: string, isError: boolean, autoCloseOption: boolean | number, clickHandler?: () => void) => {
    content.value = newContent;
    id.value = Math.random();
    type.value = isError ? "error" : "info";

    if (clickHandler !== undefined) {
        clickCb.value = clickHandler;
    }

    if ((typeof autoCloseOption === "number" && autoCloseOption > 0) || autoCloseOption === true) {
        autoClose.value = window.setTimeout(hide, typeof autoCloseOption === "number" ? autoCloseOption : 5000);
    }
};

const show = () => {
    open.value = true;
};

const hide = () => {
    open.value = false;
    if (autoClose.value) {
        clearTimeout(autoClose.value);
        autoClose.value = 0;
    }
};

defineExpose({
    update,
    show,
    hide
});
</script>

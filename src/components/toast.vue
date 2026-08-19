<template>
    <transition
        appear
        name="refresher-toast"
    >
        <div
            v-show="open"
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
import {ref} from "vue";

export type ToastLevel = "info" | "error" | "warning" | "cake";

const content = ref("");
const clickCb = ref<((ev: MouseEvent) => void) | null>(null);
const open = ref(false);
const type = ref<ToastLevel | null>(null);
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null;

const click = (ev: MouseEvent) => {
    clickCb.value?.(ev);
};

const show = (
    newContent: string,
    newType: ToastLevel,
    newAutoClose: number,
    clickHandler?: (ev: MouseEvent) => void
) => {
    if (autoCloseTimer) clearTimeout(autoCloseTimer);

    content.value = newContent;
    type.value = newType;
    clickCb.value = clickHandler ?? null;

    if (newAutoClose > 0) {
        autoCloseTimer = setTimeout(hide, newAutoClose);
    } else {
        autoCloseTimer = null;
    }

    open.value = true;
};

const hide = () => {
    if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
        autoCloseTimer = null;
    }

    open.value = false;
};

const isOpen = () => open.value;

defineExpose({
    show,
    hide,
    isOpen
});
</script>

<style lang="scss" scoped>
@use "@/assets/styles/tokens" as *;

$tablet: 768px;
$desktop: 1024px;

.refresher-toast {
    background-color: #fff;
    border: 1px solid transparent;
    border-radius: 13.3px;
    bottom: 5vh;
    color: #000;
    display: -webkit-flex;
    display: flex;
    height: 62px;
    max-width: 50vw;
    position: fixed;
    right: 5vw;
    transition: 0.3s background $ease-out-expo;
    user-select: none;
    z-index: 2002;

    @media screen and (max-width: $desktop) {
        bottom: 72px;
        max-width: 80vw;
    }

    @media screen and (max-width: $tablet) {
        height: 52px;
        max-width: unset;
        width: 90vw;
    }

    &.hover:hover {
        background-color: rgb(249, 249, 249);
    }

    &.hover:active {
        background-color: rgb(233, 233, 233);
    }

    .contents,
    .text {
        display: -webkit-flex;
        display: flex;
    }

    .contents {
        border-radius: 13.3px;
        overflow: hidden;
        padding: 5px 10px;
        position: relative;
        width: 100%;

        @media screen and (max-width: $tablet) {
            font-size: 14px;
        }

        p,
        .button,
        .text {
            margin: auto;
        }

        p {
            font-size: 16px;
            margin: auto 20px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .text .material-icons {
            margin-left: 10px;
            margin-right: 5px;
        }

        .text {
            font-weight: 300;
            letter-spacing: -0.66px;
            margin-left: -10px;
            margin-right: 0;
        }

        .button {
            cursor: pointer;
            opacity: 0.25;
            transition: 200ms opacity $ease-out-expo;
        }

        .button:hover {
            opacity: 0.45;
        }

        .button:active {
            opacity: 0.8;
        }
    }
}

.refresher-toast[data-type="error"] {
    background-color: #ff6464;
    color: #fff;
}

.refresher-toast[data-type="warning"] {
    background-color: #f7af15;
    color: #fff;
}

html:has(#css-darkmode) {
    .refresher-toast {
        background-color: #333;
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: rgb(219, 219, 219);

        &.hover:hover {
            background-color: #393939;
        }

        &.hover:active {
            background-color: #424242;
        }
    }

    .refresher-toast[data-type="error"] {
        background-color: #d41717;
        color: #fff;
    }

    .refresher-toast[data-type="warning"] {
        background-color: #eeb02b;
        color: #000;
    }
}

.refresher-toast::after {
    border-radius: 13.3px;
    box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.2),
    0px 4px 5px 0px rgba(0, 0, 0, 0.14),
    0px 1px 10px 0px rgba(0, 0, 0, 0.12);
    content: "";
    height: 100%;
    left: 0;
    opacity: 0.32;
    pointer-events: none;
    position: absolute;
    top: 0;
    width: 100%;
}

.refresher-toast-enter-active {
    transition: all 250ms cubic-bezier(0, 0, 0.2, 1);
}

.refresher-toast-leave-active {
    transition: all 200ms cubic-bezier(0.4, 0, 1, 1);
}

.refresher-toast-enter-from,
.refresher-toast-leave-to {
    opacity: 0;
    transform: translateY(10px);
}

.refresher-toast-enter-to {
    opacity: 1;
    transform: translateY(0px);
}
</style>

<template>
    <div class="refresher-bubble">
        <span
            :class="{ image: hasImage }"
            class="text"
            @click="handleTextClick"
        >
            <img
                v-if="image"
                :src="image"
                loading="lazy"
            />

            {{ displayText }}
            <span
                v-if="hasGallery"
                class="gallery"
            >
                ({{ gallery }})
            </span>
        </span>
        <span
            v-if="hasRemove"
            class="remove"
            role="button"
            tabindex="0"
            @click="handleRemoveClick"
            @keydown.enter="handleRemoveClick"
        >
            <svg
                height="14"
                viewBox="0 0 18 18"
                width="14"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M14.53 4.53l-1.06-1.06L9 7.94 4.53 3.47 3.47 4.53 7.94 9l-4.47 4.47 1.06 1.06L9 10.06l4.47 4.47 1.06-1.06L10.06 9z"
                />
            </svg>
        </span>
    </div>
</template>

<script lang="ts" setup>
import {computed} from "vue";

interface Props {
    text?: string;
    image?: string;
    isRegex?: boolean;
    gallery?: string;
    extra?: string;
    remove?: () => void;
    textclick?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
    text: "",
    isRegex: false
});

const displayText = computed(() => {
    const baseText = props.text || "";
    const extraText = props.extra ? ` (${props.extra})` : "";
    return baseText + extraText;
});

const hasImage = computed(() => Boolean(props.image));
const hasRemove = computed(() => Boolean(props.remove));
const hasGallery = computed(() => Boolean(props.gallery));

const handleTextClick = () => {
    props.textclick?.();
};

const handleRemoveClick = () => {
    props.remove?.();
};
</script>

<style lang="scss">
.refresher-bubble {
    background-color: #f9f9f9;
    border: 1px solid #d6d6d6;
    border-radius: 13.3px;
    display: flex;
    font-size: 14px;
    font-weight: normal;
    padding: 3px 16px;
    width: fit-content;

    .text {
        height: 14px;
        width: fit-content;

        &.image {
            height: unset;

            img {
                width: 80px;
            }
        }
    }

    .remove {
        background-color: #d6d6d6;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        font-weight: bold;
        height: 20px;

        justify-content: center;
        margin: auto auto auto 5px;

        text-align: center;

        transition: 0.25s all cubic-bezier(0.19, 1, 0.22, 1);

        width: 20px;

        &:hover {
            background-color: rgb(190, 190, 190);
        }

        &:active {
            background-color: rgb(155, 155, 155);
        }

        svg {
            margin: auto;
        }
    }
}
</style>
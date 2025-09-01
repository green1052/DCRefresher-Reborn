<template>
    <div class="refresher-bubble">
        <span
            :class="{ image: hasImage }"
            class="text"
            @click="handleTextClick"
        >
            <img
                v-if="image"
                :alt="text || 'Image'"
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
            aria-label="Remove item"
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
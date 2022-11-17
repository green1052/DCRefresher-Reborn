<template>
    <div class="refresher-bubble">
        <span class="text" :class="{image}" v-on:click="safeTextClick">
        <img v-if="image" :src="image"></img>
            {{ text }} {{ extra ? " (" + extra + ")" : "" }}
            <span class="gallery" v-if="gallery">({{ gallery }})</span>
      </span>
        <span v-if="remove" class="remove" v-on:click="safeRemoveClick"><svg xmlns="http://www.w3.org/2000/svg"
                                                                             width="14"
                                                                             height="14"
                                                                             viewBox="0 0 18 18"><path
            d="M14.53 4.53l-1.06-1.06L9 7.94 4.53 3.47 3.47 4.53 7.94 9l-4.47 4.47 1.06 1.06L9 10.06l4.47 4.47 1.06-1.06L10.06 9z"/></svg></span>
    </div>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
    name: "refresher-bubble",
    props: {
        text: {
            type: String
        },

        image: {
            type: String
        },

        isRegex: {
            type: Boolean
        },

        gallery: {
            type: String
        },

        extra: {
            type: String
        },

        remove: {
            type: Function
        },

        textclick: {
            type: Function
        }
    },
    methods: {
        safeTextClick() {
            if (this.textclick) {
                this.textclick();
            }
        },

        safeRemoveClick() {
            if (this.remove) {
                this.remove();
            }
        }
    }
});
</script>
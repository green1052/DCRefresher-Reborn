<template>
    <div class="refresher-input">
        <img alt="디시콘" style="width: 37px;position: relative;left: -70px;"
             v-bind:src="'https://dcimg5.dcinside.com/dccon.php?no='+value.split('||')[2]">
        <button :data-id="id" :data-module="modname" :disabled="disabled" :placeholder="placeholder" :value="value"
                style="position: absolute;right: 10px;top: 5px;background: #dddddd;border: none;padding: 5px 10px;"
                v-on:click="select">선택하기
        </button>
    </div>
</template>

<script>
import Vue from "vue";

export default Vue.extend({
    name: "refresher-dccon",
    props: {
        change: {
            type: Function
        },

        placeholder: {
            type: String,
            required: false
        },

        modname: {
            type: String
        },

        id: {
            type: String
        },

        value: {
            type: String
        },

        disabled: {
            type: Boolean
        }
    },
    methods: {
        select(ev) {
            createDCConSelector();
            window.close();
        }
    }
});
</script>
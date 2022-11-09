<template>
    <div class="refresher-input">
        <img v-bind:src="'https://dcimg5.dcinside.com/dccon.php?no='+value.split('||')[2]" alt="디시콘"
             style="width: 37px;position: relative;left: -70px;">
        <button v-on:click="select" :data-id="id" :data-module="modname" :placeholder="placeholder" :value="value"
                :disabled="disabled"
                style="position: absolute;right: 10px;top: 5px;background: #dddddd;border: none;padding: 5px 10px;">선택하기
        </button>
    </div>
</template>

<script>
export default {
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
};
</script>

<style scoped>

</style>
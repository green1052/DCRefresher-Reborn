<template>
    <div class="refresher-input">
        <input type="text" :data-id="id" :data-module="modname" :placeholder="placeholder" :value="value" :disabled="disabled" v-on:change="update"/>
    </div>
</template>

<script>
export default {
    name: "refresher-input",

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
        update(ev) {
            if (this.change) {
                this.change(
                    ev.target.dataset.module,
                    ev.target.dataset.id,
                    ev.target.value
                );
            }
        }
    }
};
</script>
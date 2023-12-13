<template>
  <div
      :data-id="id"
      :data-module="modname"
      class="refresher-options"
  >
    <select :disabled="disabled" @change="toggle">
      <option v-for="[name, value] in Object.entries(options)" :selected="value === selected" :value="value">
        {{ name }}
      </option>
    </select>
  </div>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
  name: "refresher-options",
  props: {
    change: {
      type: Function
    },

    modname: {
      type: String,
      required: false
    },

    options: {
      type: Object
    },

    id: {
      type: String
    },

    disabled: {
      type: Boolean
    },

    selected: {
      type: String
    }
  },
  methods: {
    toggle(ev: Event) {
      console.log(this.$el.dataset.module,
          this.$el.dataset.id,
          ev.target?.value)

      if (this.disabled) {
        return;
      }

      this.change?.(
          this.$el.dataset.module,
          this.$el.dataset.id,
          ev.target?.value
      );
    }
  }
});
</script>

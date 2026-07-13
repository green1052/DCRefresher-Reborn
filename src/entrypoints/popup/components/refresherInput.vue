<template>
  <div class="refresher-input">
    <input
        :disabled="disabled"
        :placeholder="placeholder"
        :value="value"
        type="text"
        @change="handleChange"
        @input="handleInput"
    />
  </div>
</template>

<script lang="ts" setup>
interface Props {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  value: "",
  disabled: false
});

const emit = defineEmits<{
  "update:value": [value: string];
  change: [value: string];
}>();

const handleInput = (ev: Event) => {
  const target = ev.target as HTMLInputElement;
  emit("update:value", target.value);
};

const handleChange = (ev: Event) => {
  const target = ev.target as HTMLInputElement;
  emit("change", target.value);
};
</script>

<style lang="scss" scoped>
.refresher-input {
  align-items: center;
  display: flex;

  input {
    background-color: #fff;
    border: 1px solid #aaa;
    border-radius: 9px;
    color: black;
    font-size: 15px;
    min-width: 150px;
    padding: 4px 16px;
    transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);

    &:focus {
      border-color: #4caf50;
      box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
      outline: none;
    }

    &:disabled {
      background-color: #f5f5f5;
      color: #999;
      cursor: not-allowed;
    }

    &::placeholder {
      color: #999;
    }
  }
}

@media (prefers-color-scheme: dark) {
  .refresher-input {
    input {
      background-color: #3b3b3b;
      border: 1px solid rgb(90, 90, 90);
      color: white;

      &:focus {
        border-color: #66bb6a;
        box-shadow: 0 0 0 2px rgba(102, 187, 106, 0.2);
      }

      &:disabled {
        background-color: #2a2a2a;
        color: #666;
      }

      &::placeholder {
        color: #666;
      }
    }
  }
}
</style>
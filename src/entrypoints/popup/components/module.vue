<template>
  <div class="refresher-module">
    <div class="left">
      <p class="title">
        {{ name }}
      </p>
      <p class="desc">
        {{ desc }}
      </p>
    </div>
    <div class="right">
      <RefresherCheckbox
          :model-value="enabled"
          @change="handleToggle"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import {inject} from "vue";
import RefresherCheckbox from "./checkbox.vue";

interface Props {
  name: string;
  desc: string;
  enabled: boolean;
}

const props = defineProps<Props>();

const {updateModuleStatus} = inject("settings")!;

const handleToggle = async (value: boolean) => {
  try {
    await updateModuleStatus(props.name, value);
  } catch (error) {
    console.error("Failed to update module status:", error);
  }
};
</script>

<style lang="scss" scoped>
.refresher-module {
  background-color: #f8f8f8;
  border-radius: 13.3px;
  display: flex;
  margin-bottom: 5px;
  padding: 13px 23px;
  position: relative;
  transition: all 0.25s cubic-bezier(0.19, 1, 0.22, 1);

  &.highlight {
    animation: highlight-blink 1s;
  }

  .left {
    flex: 1;
    letter-spacing: -0.66px;

    .title {
      color: #333;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 4px;
    }

    .desc {
      color: #666;
      font-size: 14px;
      line-height: 1.4;
      margin-bottom: 4px;
    }

    .mute {
      color: #a0a0a0;
      font-size: 12px;
      letter-spacing: -0.66px;

      .link {
        border-bottom: 1px solid #a0a0a0;
        cursor: pointer;
        transition: color 0.25s cubic-bezier(0.19, 1, 0.22, 1);

        &:hover {
          border-bottom-color: #4caf50;
          color: #4caf50;
        }
      }
    }
  }

  .right {
    align-items: center;
    display: flex;
    margin-bottom: auto;
    margin-left: auto;
    margin-top: auto;
  }
}

@keyframes highlight-blink {
  0%,
  50% {
    background-color: #afdbff;
  }

  40%,
  100% {
    background-color: #f8f8f8;
  }
}

@keyframes highlight-blink-dark {
  0%,
  50% {
    background-color: #223957;
  }

  40%,
  100% {
    background-color: #2c2c2c;
  }
}

@media (prefers-color-scheme: dark) {
  .refresher-module {
    background-color: #2c2c2c;

    &.highlight {
      animation: highlight-blink-dark 1s;
    }

    .left {
      .title {
        color: #e0e0e0;
      }

      .desc {
        color: #b0b0b0;
      }

      .mute {
        color: #888;

        .link {
          &:hover {
            border-bottom-color: #66bb6a;
            color: #66bb6a;
          }
        }
      }
    }
  }
}
</style>
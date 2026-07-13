<template>
  <div class="tab tab4">
    <div
        v-if="!hasModules"
        class="refresher-no-modules"
    >
      <h3>로드된 모듈 없음</h3>
      <p>우선 디시 페이지를 열어주세요.</p>
    </div>
    <div v-else>
      <refresher-module
          v-for="module in modules"
          :key="module.name"
          :desc="module.description ?? ''"
          :enabled="module.enable"
          :name="module.name"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import {inject} from "vue";
import RefresherModule from "../components/module.vue";

const {modules, hasModules} = inject("settings")!;
</script>
<template>
  <div class="tab tab2">
    <div class="section-header">
      <h2>데이터 관리</h2>
      <div class="section-actions">
        <button @click="exportBlock">내보내기</button>
        <button @click="importBlock">가져오기</button>
      </div>

      <br/>
      <br/>

      <h2>차단 모드</h2>
      <div
          v-for="key in blockTypes"
          :key="key"
          class="mode-row"
      >
        <label>{{ blockKeyNames[key] }}:</label>
        <select
            v-model="blockModes[key]"
            @change="editBlockMode"
        >
          <option
              v-for="[key2, value2] in Object.entries(blockDetectModeTypeNames)"
              :key="key2"
              :value="key2"
          >
            {{ value2 }}
          </option>
        </select>
      </div>
    </div>

    <div
        v-for="key in blockTypes"
        :key="key"
        class="block-divide"
    >
      <h3>
        {{ blockKeyNames[key] }} ({{ blocks[key].length }}개)
        <span
            class="plus"
            @click="openBlockDialog(key)"
        >
          <PlusIcon/>
        </span>
        <span
            class="remove"
            @click="removeAllBlockedUser(key)"
        >
          <RemoveIcon/>
        </span>
      </h3>

      <div class="lists">
        <p v-if="!blocks[key].length">차단된 {{ blockKeyNames[key] }} 없음</p>
        <refresher-bubble
            v-for="(blocked, i) in blocks[key]"
            v-else-if="key !== 'DCCON'"
            :key="`block:${i}`"
            :extra="blocked.extra"
            :gallery="blocked.gallery"
            :regex="blocked.isRegex"
            :remove="() => removeBlockedUser(key, i)"
            :text="blocked.content"
            :textclick="() => editBlockedUser(key, i)"
        />
        <refresher-bubble
            v-for="(blocked, i) in blocks[key]"
            v-else
            :key="`block:${i}`"
            :extra="blocked.extra"
            :gallery="blocked.gallery"
            :image="`https://image.dcinside.com/dccon.php?no=${blocked.isRegex ? (blocked.content.match(/^\^\((\w*)\|/)?.at(1) ?? blocked.content) : blocked.content}`"
            :regex="blocked.isRegex"
            :remove="() => removeBlockedUser(key, i)"
            :textclick="() => editBlockedUser(key, i)"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {inject} from "vue";
import RefresherBubble from "../components/bubble.vue";
import {PlusIcon, RemoveIcon} from "../components/icons";

const {
  blocks,
  blockModes,
  blockKeyNames,
  blockDetectModeTypeNames,
  blockTypes,
  openBlockDialog,
  removeBlockedUser,
  removeAllBlockedUser,
  editBlockedUser,
  editBlockMode,
  exportBlock,
  importBlock
} = inject("blocks")!;
</script>
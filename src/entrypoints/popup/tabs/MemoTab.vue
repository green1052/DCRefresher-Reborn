<template>
    <div class="tab tab3">
        <div class="section-header">
            <h2>데이터 관리</h2>
            <div class="section-actions">
                <button @click="exportMemo">내보내기</button>
                <button @click="importMemo">가져오기</button>
                <button @click="open('https://dcrefresher.green1052.com/utils/convert-memo')">메모 변환</button>
            </div>
            <br/>
        </div>

        <div
            v-for="key in memoTypes"
            :key="key"
            class="block-divide"
        >
            <h3>
                {{ memoKeyNames[key] }} ({{ Object.keys(memos[key]).length }}개)
                <span
                    class="plus"
                    @click="addMemoUser(key)"
                >
          <PlusIcon/>
        </span>
                <span
                    class="remove"
                    @click="removeAllMemoUser(key)"
                >
          <RemoveIcon/>
        </span>
            </h3>

            <div class="lists">
                <p v-if="!Object.keys(memos[key]).length">{{ memoKeyNames[key] }} 메모 없음</p>
                <refresher-bubble
                    v-for="[user, memo] in Object.entries(memos[key])"
                    v-else
                    :key="`memo:${user}`"
                    :remove="() => removeMemoUser(key, user)"
                    :text="`${user} (${memo.text.substring(0, 10)})`"
                    :textclick="() => editMemoUser(key, user)"
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
    memos,
    memoKeyNames,
    memoTypes,
    removeMemoUser,
    removeAllMemoUser,
    addMemoUser,
    editMemoUser,
    exportMemo,
    importMemo
} = inject("memos")!;

const open = (url: string) => {
    browser.tabs.create({url});
};
</script>
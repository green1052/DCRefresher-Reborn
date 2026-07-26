<template>
    <div class="tab tab6">
        <div class="section-header">
            <h2>데이터 관리</h2>
            <div class="section-actions">
                <button
                    :disabled="loading"
                    @click="backupCloud"
                >
                    클라우드 백업
                </button>
                <button
                    :disabled="loading"
                    @click="recoverCloud"
                >
                    클라우드 복원
                </button>
            </div>

            <p
                v-if="lastUpdate > 0"
                class="data-last-update"
            >
                마지막 백업: {{ new Date(lastUpdate).toLocaleString() }}
            </p>

            <br/>
            <br/>

            <div class="section-actions">
                <button
                    :disabled="loading"
                    @click="exportData"
                >
                    데이터 내보내기
                </button>
                <button
                    :disabled="loading"
                    @click="importData"
                >
                    데이터 가져오기
                </button>
                <button
                    :disabled="loading"
                    class="danger"
                    @click="clearData"
                >
                    ⚠️ 데이터 초기화 ⚠️
                </button>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import {inject, onMounted} from "vue";
import type {useData} from "../composables/useData";

const {
    lastUpdate,
    loading,
    refreshLastUpdate,
    backupCloud,
    recoverCloud,
    exportData,
    importData,
    clearData
} = inject<ReturnType<typeof useData>>("data")!;

onMounted(refreshLastUpdate);
</script>
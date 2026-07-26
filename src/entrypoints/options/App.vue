<template>
    <PopupApp options-page/>
</template>

<script lang="ts" setup>
import PopupApp from "../popup/App.vue";
</script>

<style lang="scss">
/* options 페이지 전용 - popup 고정 크기/위치 제거 */
html, body {
    height: auto;
    min-height: 100vh;
    overflow-y: auto;
    margin: 0;
    padding: 0;
}

#refresher-app.options-page {
    width: 100% !important;
    height: auto !important;
    min-height: 100vh;
    max-width: none !important;
    margin: 0 !important;
    border-radius: 0 !important;
    overflow: visible;
    display: block;

    .refresher-title-zone {
        position: relative !important;
        width: 100%;
        max-width: 1200px;
        margin: 0 auto;
        padding: 10px 24px;
        box-sizing: border-box;
        z-index: auto;
    }

    .tab {
        position: relative !important;
        width: 100% !important;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px 24px 40px;
        height: auto !important;
        box-sizing: border-box;
        overflow-y: visible;
    }
}
</style>

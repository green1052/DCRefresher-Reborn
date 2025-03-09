<template>
    <transition name="refresher-opacity">
        <div class="refresher-loader spinner gray animating">
            <div class="spinner-blade" />
            <div class="spinner-blade" />
            <div class="spinner-blade" />
            <div class="spinner-blade" />
            <div class="spinner-blade" />
            <div class="spinner-blade" />
            <div class="spinner-blade" />
            <div class="spinner-blade" />
            <div class="spinner-blade" />
            <div class="spinner-blade" />
            <div class="spinner-blade" />
            <div class="spinner-blade" />
        </div>
    </transition>
</template>

<script lang="ts">
import Vue from "vue";

export default Vue.extend({
    name: "refresher-loader"
});
</script>

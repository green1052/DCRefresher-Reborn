<template>
    <transition name="refresher-opacity">
        <div class="refresher-loader spinner gray animating">
            <div class="spinner-blade"></div>
            <div class="spinner-blade"></div>
            <div class="spinner-blade"></div>
            <div class="spinner-blade"></div>
            <div class="spinner-blade"></div>
            <div class="spinner-blade"></div>
            <div class="spinner-blade"></div>
            <div class="spinner-blade"></div>
            <div class="spinner-blade"></div>
            <div class="spinner-blade"></div>
            <div class="spinner-blade"></div>
            <div class="spinner-blade"></div>
        </div>
    </transition>
</template>

<script>
import Vue from "vue";

export default Vue.extend({
    name: "refresher-loader"
});
</script>
<template>
    <div class="refresher-dccon-popup">
        <h3>디시콘</h3>

        <div class="close" @click="close">
            <div class="cross"/>
            <div class="cross"/>
        </div>

        <hr>

        <refresher-loader v-if="dcconList === null"/>
        <fragment v-else>
            <ul style="overflow: auto; display: flex;">
                <li v-for="dccon in dcconList.list" :key="dccon.title">
                    <img :alt="dccon.title" :src="dccon.main_img_url" @click="dcconListClick(dccon.detail)"/>
                </li>
            </ul>

            <hr>

            <div style="width: 100%; height: 80%; overflow: auto;">
                <ul>
                    <li v-for="dccon in this.currentDccon" style="float: left;"
                        @click="dcconClick(dccon)">
                        <img :alt="dccon.title" :src="dccon.list_img"/>
                    </li>
                </ul>
            </div>
        </fragment>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import Cookies from "js-cookie";
import * as http from "../utils/http";
import {Fragment} from "vue-fragment";
import RefresherLoader from "./loader.vue";

interface DcconPopupData {
    dcconList: DcinsideDcconDetail | null;
    currentDccon: DcinsideDccon[] | null;
}

export default Vue.extend({
    name: "refresher-dccon-popup",
    data: (): DcconPopupData => {
        return {
            dcconList: null,
            currentDccon: null
        }
    },
    async created() {
        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("target", "icon");
        params.set("page", "0");

        http.make("https://gall.dcinside.com/dccon/lists", {
            method: "POST",
            headers: {
                Origin: "https://gall.dcinside.com",
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
            },
            cache: "no-store",
            body: `?${params.toString()}`
        })
            .then((response) => {
                this.dcconList = JSON.parse(response);
                this.currentDccon = this.dcconList!.list[0].detail;
            });
    },
    methods: {
        dcconListClick(dccons: DcinsideDccon[]) {
            this.currentDccon = dccons;
        },
        dcconClick(dccon: DcinsideDccon) {
            this.$emit("clickDccon", dccon);
        },
        close() {
            this.$emit("closeDccon");
        }
    },
    components: {
        RefresherLoader,
        Fragment
    }
});
</script>
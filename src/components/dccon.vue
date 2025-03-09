<template>
    <div class="refresher-dccon-popup">
        <div style="display: flex">
            <h3>디시콘</h3>

            <div>
                <input v-model="doubleDccon" type="checkbox" />
                <label>더블콘</label>
            </div>

            <div class="close" @click="close">
                <div class="cross" />
                <div class="cross" />
            </div>
        </div>

        <refresher-loader v-if="!Object.keys(dcconList).length" />
        <fragment v-else>
            <hr />

            <ul style="overflow: auto; display: flex; user-select: none; justify-content: center">
                <li style="font-size: 30px; margin-right: 5px" @click="pageDown()"><</li>
                <li v-for="dccon in dcconList[currentPage]" :key="dccon.title">
                    <img
                        :alt="dccon.title"
                        :src="dccon.main_img_url"
                        @click="dcconListClick(dccon.detail)"
                    />
                </li>
                <li style="font-size: 30px; margin-left: 5px" @click="pageUp()">></li>
            </ul>

            <hr />

            <div style="width: 100%; height: 80%; overflow: auto">
                <h2 v-if="firstLoad" style="position: absolute; top: 50%; left: 35%">
                    디시콘을 클릭해주세요.
                </h2>
                <ul v-else style="display: flex; flex-wrap: wrap">
                    <li v-for="dccon in this.currentDccon" @click="dcconClick(dccon)">
                        <img :alt="dccon.title" :src="dccon.list_img" style="height: 100px" />
                    </li>
                </ul>
            </div>
        </fragment>
    </div>
</template>

<script lang="ts">
import Vue from "vue";
import Cookies from "js-cookie";
import { Fragment } from "vue-fragment";
import RefresherLoader from "./loader.vue";
import ky from "ky";

interface DcconPopupData {
    firstLoad: boolean;
    currentPage: number;
    maxPage: number;
    dcconList: Record<number, DcinsideDcconDetailList[]>;
    currentDccon: DcinsideDccon[] | null;
    doubleDccon: boolean;
    selectedDccon: DcinsideDccon[];
}

export default Vue.extend({
    name: "refresher-dccon-popup",
    data: (): DcconPopupData => {
        return {
            firstLoad: true,
            currentPage: 0,
            maxPage: 1,
            dcconList: {},
            currentDccon: null,
            doubleDccon: false,
            selectedDccon: []
        };
    },
    created() {
        this.getDcconList();
    },
    methods: {
        pageUp() {
            if (this.currentPage === this.maxPage) {
                this.currentPage = 0;
            } else if (this.currentPage < this.maxPage) {
                this.currentPage++;
            }

            this.getDcconList();
        },
        pageDown() {
            if (this.currentPage === 0) {
                this.currentPage = this.maxPage;
            } else if (this.currentPage > 0) {
                this.currentPage--;
            }

            this.getDcconList();
        },
        async getDcconList() {
            if (this.dcconList[this.currentPage]) {
                this.currentDccon = this.dcconList[this.currentPage][0].detail;
                return;
            }

            const params = new URLSearchParams();
            params.set("ci_t", Cookies.get("ci_c") ?? "");
            params.set("target", "icon");
            params.set("page", String(this.currentPage));

            const response = await ky
                .post("https://gall.dcinside.com/dccon/lists", {
                    body: params
                })
                .json<DcinsideDcconDetail>();

            if (response.target === "shop") {
                alert("사용 가능한 디시콘이 없습니다.");
                this.close();
                return;
            }

            this.dcconList = {
                ...this.dcconList,
                [this.currentPage]: response.list
            };

            this.maxPage = response.max_page;
            this.currentDccon = response.list[0].detail;
        },
        dcconListClick(dccons: DcinsideDccon[]) {
            this.firstLoad = false;
            this.currentDccon = dccons;
        },
        dcconClick(dccon: DcinsideDccon) {
            if (this.doubleDccon) {
                this.selectedDccon.push(dccon);

                if (this.selectedDccon.length === 2) {
                    this.$emit("clickDccon", this.selectedDccon);
                    this.close();
                }
            } else {
                this.$emit("clickDccon", [dccon]);
                this.close();
            }
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

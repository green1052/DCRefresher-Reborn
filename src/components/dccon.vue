<template>
    <div class="refresher-dccon-popup">
        <div style="display: flex">
            <h3>디시콘</h3>

            <div>
                <input
                    v-model="doubleDccon"
                    type="checkbox"
                />
                <label>더블콘</label>
            </div>

            <div>
                <input
                    v-model="bigDccon"
                    type="checkbox"
                />
                <label>대왕콘</label>
            </div>

            <div
                class="close"
                @click="close"
            >
                <div class="cross" />
                <div class="cross" />
            </div>
        </div>

        <refresher-loader v-if="!Object.keys(dcconList).length" />
        <template v-else>
            <hr />

            <ul style="overflow: auto; display: flex; user-select: none; justify-content: center">
                <li
                    style="font-size: 30px; margin-right: 5px"
                    @click="pageDown()"
                >
                    &gt;
                </li>
                <li
                    v-for="dccon in dcconList[currentPage]"
                    :key="dccon.title"
                >
                    <img
                        :alt="dccon.title"
                        :src="dccon.main_img_url"
                        @click="dcconListClick(dccon.detail)"
                    />
                </li>
                <li
                    style="font-size: 30px; margin-left: 5px"
                    @click="pageUp()"
                >
                    &lt;
                </li>
            </ul>

            <hr />

            <div style="width: 100%; height: 80%; overflow: auto">
                <h2
                    v-if="firstLoad"
                    style="position: absolute; top: 50%; left: 35%"
                >
                    디시콘을 클릭해주세요.
                </h2>
                <ul
                    v-else
                    style="display: flex; flex-wrap: wrap"
                >
                    <li
                        v-for="dccon in currentDccon"
                        @click="dcconClick(dccon)"
                    >
                        <img
                            :alt="dccon.title"
                            :src="dccon.list_img"
                            style="height: 100px"
                        />
                    </li>
                </ul>
            </div>
        </template>
    </div>
</template>

<script lang="ts" setup>
import Cookies from "js-cookie";
import ky from "ky";
import { onMounted, ref } from "vue";

import RefresherLoader from "./loader.vue";

interface Emits {
    clickDccon: [dccons: DcinsideDccon[], bigDccon: boolean];
    closeDccon: [];
}

const emit = defineEmits<Emits>();

const firstLoad = ref(true);
const currentPage = ref(0);
const maxPage = ref(1);
const dcconList = ref<Record<number, DcinsideDcconDetailList[]>>({});
const currentDccon = ref<DcinsideDccon[] | null>(null);
const doubleDccon = ref(false);
const bigDccon = ref(false);
const selectedDccon = ref<DcinsideDccon[]>([]);

const pageUp = () => {
    if (currentPage.value === maxPage.value) {
        currentPage.value = 0;
    } else if (currentPage.value < maxPage.value) {
        currentPage.value++;
    }

    getDcconList();
};

const pageDown = () => {
    if (currentPage.value === 0) {
        currentPage.value = maxPage.value;
    } else if (currentPage.value > 0) {
        currentPage.value--;
    }

    getDcconList();
};

const getDcconList = async () => {
    if (dcconList.value[currentPage.value]) {
        currentDccon.value = dcconList.value[currentPage.value][0].detail;
        return;
    }

    try {
        const params = new URLSearchParams();
        params.set("ci_t", Cookies.get("ci_c") ?? "");
        params.set("target", "icon");
        params.set("page", String(currentPage.value));

        const response = await ky
            .post("https://gall.dcinside.com/dccon/lists", {
                body: params
            })
            .json<DcinsideDcconDetail>();

        if (response.target === "shop") {
            alert("사용 가능한 디시콘이 없습니다.");
            close();
            return;
        }

        dcconList.value = {
            ...dcconList.value,
            [currentPage.value]: response.list
        };

        maxPage.value = response.max_page;
        currentDccon.value = response.list[0].detail;
    } catch (error) {
        console.error("Failed to load dccon list:", error);
        alert("디시콘을 불러오는데 실패했습니다.");
        close();
    }
};

const dcconListClick = (dccons: DcinsideDccon[]) => {
    firstLoad.value = false;
    currentDccon.value = dccons;
};

const dcconClick = (dccon: DcinsideDccon) => {
    if (doubleDccon.value) {
        selectedDccon.value.push(dccon);

        if (selectedDccon.value.length === 2) {
            emit("clickDccon", selectedDccon.value, bigDccon.value);
            close();
        }
    } else {
        emit("clickDccon", [dccon], bigDccon.value);
        close();
    }
};

const close = () => {
    emit("closeDccon");
};

onMounted(() => {
    getDcconList();
});
</script>

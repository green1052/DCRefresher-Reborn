<template>
    <div class="refresher-dccon-popup">
        <div style="display: flex">
            <h3>디시콘</h3>

            <div style="margin-top: 3px">
                <input
                    v-model="doubleDccon"
                    type="checkbox"
                />
                <label>더블콘</label>

                <input
                    v-model="bigDccon"
                    type="checkbox"
                />
                <label>대왕콘</label>
            </div>

            <div class="refresh" @click="getDcconList(true)">
                <img :src="getURL('/assets/refresh.webp')"/>
            </div>

            <div
                class="close"
                @click="close"
            >
                <div class="cross"/>
                <div class="cross"/>
            </div>
        </div>

        <refresher-loader v-if="!Object.keys(dcconList).length"/>
        <template v-else>
            <hr/>

            <ul style="overflow: auto; display: flex; user-select: none; justify-content: center">
                <li
                    style="font-size: 30px; margin-right: 5px"
                    @click="pageDown()"
                >
                    &lt;
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
                    &gt;
                </li>
            </ul>

            <hr/>

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
                        :key="dccon.detail_idx"
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
import {onMounted, ref} from "vue";
import getURL from "../utils/getURL";

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

const getDcconList = async (refresh = false) => {
    if (!refresh && dcconList.value[currentPage.value]) {
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
    } catch {
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

onMounted(getDcconList);
</script>

<style lang="scss" scoped>
$dark-tint-light: #292929;

.refresher-dccon-popup {
    backdrop-filter: blur(5px) saturate(150%);
    background-color: rgba(255, 255, 255, 0.85);
    border-radius: 13.3px;
    box-shadow: 0 0 16px rgba(51, 51, 51, 0.3);
    height: 500px;
    left: calc(50% - 350px);
    padding: 20px 30px;
    position: fixed;
    top: calc(50% - 300px);
    width: 620px;

    z-index: 2001;

    & > p {
        font-size: 18px;
        font-weight: bold;
    }

    h3 {
        font-size: 18px;
    }

    .refresh {
        margin-left: auto;
        margin-right: 20px;
        margin-top: -5px;

        img {
            height: 25px;
            width: 25px;
        }
    }

    .close {
        content: " ";
        font-size: 24px;
        margin-top: 5px;
        position: absolute;
        right: 10px;

        &:after {
            content: " ";
            cursor: pointer;
            display: block;
            height: 35px;
            left: -3.5px;
            position: relative;
            top: -15px;
            width: 35px;
        }

        .cross {
            background-color: #000;
            height: 2px;
            position: absolute;
            width: 25px;

            &:hover {
                background-color: rgb(49, 49, 49);
            }

            &:first-child {
                transform: rotateZ(45deg);
            }

            &:last-child {
                transform: rotateZ(-45deg);
            }
        }
    }
}

html:has(#css-darkmode) {
    .refresher-dccon-popup {
        background-color: $dark-tint-light;
        border: 1px solid #505050;
        box-shadow: 0 0 16px rgba(51, 51, 51, 0.3);
        color: white;

        .close {
            .cross {
                background-color: #fff;
            }

            &:hover {
                .cross {
                    background-color: rgb(202, 202, 202);
                }
            }
        }
    }
}
</style>
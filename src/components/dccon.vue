<template>
    <div class="refresher-dccon-popup">
        <div class="dccon-header">
            <h3>디시콘</h3>

            <div class="dccon-options">
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
                <img :src="getAssetURL('refresh')"/>
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

            <ul class="dccon-pager">
                <li
                    class="pager-prev"
                    @click="pageDown()"
                >
                    &lt;
                </li>
                <li
                    v-for="dccon in dcconList[currentPage]"
                    :key="dccon.title"
                    class="pager-item"
                >
                    <img
                        :alt="dccon.title"
                        :src="dccon.main_img_url"
                        class="pager-img"
                        @click="dcconListClick(dccon.detail)"
                    />
                </li>
                <li
                    class="pager-next"
                    @click="pageUp()"
                >
                    &gt;
                </li>
            </ul>

            <hr/>

            <div class="dccon-grid-wrap">
                <h2
                    v-if="firstLoad"
                    class="dccon-placeholder"
                >
                    디시콘을 클릭해주세요.
                </h2>
                <ul
                    v-else
                    class="dccon-grid"
                >
                    <li
                        v-for="dccon in currentDccon"
                        class="dccon-grid-item"
                        @click="dcconClick(dccon)"
                    >
                        <img
                            :alt="dccon.title"
                            :src="dccon.list_img"
                            class="dccon-grid-img"
                        />
                    </li>
                </ul>
            </div>
        </template>
    </div>
</template>

<script lang="ts" setup>
import Cookies from "js-cookie";
import ky from "../utils/httpClient";
import {getAssetURL} from "../utils/assetURL";
import {onMounted, ref} from "vue";

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
@use "@/assets/styles/variables" as *;

$dark-tint-light: #292929;

.refresher-dccon-popup {
    backdrop-filter: blur(5px) saturate(150%);
    background-color: var(--refresher-bg-popup);
    border-radius: $radius-md;
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

// Extracted inline styles
.dccon-header {
    display: flex;
}

.dccon-options {
    margin-top: 3px;
}

.dccon-pager {
    column-gap: 4px;
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    user-select: none;

    .pager-prev {
        font-size: 30px;
        margin-right: 5px;
    }

    .pager-next {
        font-size: 30px;
        margin-left: 5px;
    }

    .pager-item {
        width: auto;
    }

    .pager-img {
        height: 53.3px;
        max-width: 53.3px;
        object-fit: cover;
        width: 100%;
    }
}

.dccon-grid-wrap {
    height: 80%;
    overflow: auto;
    width: 100%;
}

.dccon-placeholder {
    left: 35%;
    position: absolute;
    top: 50%;
}

.dccon-grid {
    display: grid;
    gap: 4px;
    grid-template-columns: repeat(6, 1fr);
}

.dccon-grid-item {
    cursor: pointer;
}

.dccon-grid-img {
    height: 100px;
    object-fit: contain;
    width: 100%;
}
</style>
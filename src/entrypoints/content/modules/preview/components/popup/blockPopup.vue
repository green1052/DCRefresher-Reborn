<script lang="ts" setup>
import {ref} from "vue";

const emit = defineEmits<{
    submit: [payload: {
        avoidHour: number;
        avoidReason: number;
        avoidReasonTxt: string;
        delChk: number;
        userType: number
    }];
    close: [];
}>();

const avoidHour = ref(1);
const avoidReason = ref(1);
const reasonText = ref("");
const remove = ref(false);
const userType = ref(false);

const durations = [
    {value: 1, label: "1시간"},
    {value: 6, label: "6시간"},
    {value: 24, label: "24시간"},
    {value: 168, label: "7일"},
    {value: 336, label: "14일"},
    {value: 744, label: "31일"}
];

const reasons = [
    {value: 1, label: "음란성"},
    {value: 2, label: "광고"},
    {value: 3, label: "욕설"},
    {value: 4, label: "도배"},
    {value: 5, label: "저작권 침해"},
    {value: 6, label: "명예훼손"},
    {value: 0, label: "직접 입력"}
];

const onReasonChange = (): void => {
    // reasonText input visibility is controlled by v-show in template
};

const submit = (): void => {
    emit("submit", {
        avoidHour: avoidHour.value,
        avoidReason: avoidReason.value,
        avoidReasonTxt: reasonText.value,
        delChk: remove.value ? 1 : 0,
        userType: userType.value ? 1 : 0
    });
};
</script>

<template>
    <div class="refresher-block-popup">
        <div class="close" @click="emit('close')">
            <div class="cross"></div>
            <div class="cross"></div>
        </div>
        <div class="contents">
            <div class="block">
                <h3>차단 기간</h3>
                <div class="block_duration">
                    <label v-for="d in durations" :key="d.value">
                        <input v-model="avoidHour" :value="d.value" name="duration" type="radio"/>
                        {{ d.label }}
                    </label>
                </div>
            </div>
            <div class="block">
                <h3>차단 사유</h3>
                <div class="block_reason">
                    <label v-for="r in reasons" :key="r.value">
                        <input v-model="avoidReason" :value="r.value" name="reason" type="radio"
                               @change="onReasonChange"/>
                        {{ r.label }}
                    </label>
                </div>
                <input
                    v-show="avoidReason === 0"
                    v-model="reasonText"
                    name="reason_text"
                    placeholder="차단 사유 직접 입력 (한글 20자 이내)"
                    type="text"
                />
            </div>
            <div class="block">
                <h3>선택한 글 삭제</h3>
                <input v-model="remove" name="remove" type="checkbox"/>

                <h3>식별 코드 차단 시 IP 동시 차단</h3>
                <input v-model="userType" name="user-type" type="checkbox"/>

                <button class="go-block" @click="submit">차단</button>
            </div>
        </div>
    </div>
</template>

<style lang="scss">
@use "@/assets/styles/variables" as *;
@use "@/assets/styles/components/popup" as *;

.refresher-block-popup {
    @include popup-shell;

    height: 320px;
    left: calc(120px);
    top: calc(50% - 160px);
    width: 420px;

    .contents {
        margin-top: 30px;

        & > div {
            margin-bottom: 20px;
        }

        input[type=text] {
            border-radius: 6px;
            height: 33px;
            margin-top: 5px;
            width: 100%;
        }

        button {
            background-color: var(--refresher-danger);
            border-radius: $radius-md;
            color: #fff;
            display: block;
            height: 40px;
            margin-left: auto;
            margin-top: 10px;
            position: relative;
            width: 120px;
        }
    }
}

html:has(#css-darkmode) .refresher-block-popup {
    border: 1px solid var(--refresher-border);
    color: white;
}
</style>
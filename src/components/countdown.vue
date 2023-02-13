<template>
    <div
        :title="locale"
        class="refresher-countdown"
        @click="this.$root.$children[0].changeStamp">
        <transition name="refresher-opacity">
            <span :key="`stamp${this.$root.$children[0].stampMode}`"
                >삭제 :
                {{ this.$root.$children[0].stampMode ? locale : stamp }}</span
            >
        </transition>
    </div>
</template>

<script lang="ts">
    import Vue, { PropType } from "vue";
    import * as stream from "stream";

    const s = 1000;
    const m = s * 60;
    const h = m * 60;
    const d = h * 24;
    const w = d * 7;
    const y = d * 365.25;

    const timeCounts = [y, w, d, h, m, s];
    const timeFilters = ["년", "주", "일", "시간", "분", "초"];

    const convertTime = (date: Date) => {
        const estimate = date.getTime() - Date.now();

        if (estimate < 3000) {
            return "잠시 후";
        }

        const abs = Math.abs(estimate);
        for (let f = 0; f < timeCounts.length; f++) {
            if (abs >= timeCounts[f]) {
                return (
                    Math.round(estimate / timeCounts[f]) +
                    timeFilters[f] +
                    " 후"
                );
            }
        }

        return "이미 삭제 됨";
    };

    interface CountdownVueData {
        parseDate: Date;
        mode: number;
        stamp: string;
        updates: number;
    }

    export default Vue.extend({
        name: "refresher-countdown",
        props: {
            date: {
                type: String,
                required: true
            }
        },
        data: (): CountdownVueData => {
            return {
                parseDate: new Date(),
                mode: 0,
                stamp: "",
                updates: 0
            };
        },
        computed: {
            locale(): string {
                return this.parseDate.toLocaleString();
            }
        },
        mounted(): void {
            this.parseDate = new Date(this.date);

            this.stamp = convertTime(this.parseDate);

            this.updates = window.setInterval(() => {
                this.stamp = convertTime(this.parseDate);
            }, 5000);
        },

        beforeDestroy() {
            clearInterval(this.updates);
        }
    });
</script>

const s = 1000;
const m = s * 60;
const h = m * 60;
const d = h * 24;
const w = d * 7;
const y = d * 365.25;

const timeCounts = [y, w, d, h, m, s];
const timeFilters = ["년", "주", "일", "시간", "분", "초"];

const convertTime = (date: Date) => {
    const elapsed = Date.now() - date.getTime();

    if (elapsed < 3000) {
        return "방금 전";
    }

    const abs = Math.abs(elapsed);

    for (let f = 0; f < timeCounts.length; f++) {
        if (abs >= timeCounts[f]) {
            return Math.round(elapsed / timeCounts[f]) + timeFilters[f] + " 전";
        }
    }

    return "아주 오래 전";
};

interface TimestampVueData {
    mode: number;
    stamp: string;
}

interface TimestampVue extends TimestampVueData {
    date: Date;
    updates: number;
}

export default {
    template: `
      <div class="refresher-timestamp" v-on:click="this.$root.changeStamp" :title="locale">
      <transition name="refresher-opacity">
        <span :key="'stamp' + this.$root.stampMode">{{ this.$root.stampMode ? locale : stamp }}</span>
      </transition>
      </div>`,
    props: {
        date: {
            type: Date,
            required: true
        }
    },
    data: (): TimestampVueData => {
        return {
            mode: 0,
            stamp: ""
        };
    },
    computed: {
        locale (this: TimestampVue): string {
            return this.date.toLocaleString();
        }
    },
    mounted (this: TimestampVue): void {
        this.stamp = convertTime(this.date);

        this.updates = window.setInterval(() => {
            this.stamp = convertTime(this.date);
        }, 3000);
    },

    beforeUnload (this: TimestampVue): void {
        clearInterval(this.updates);
    }
};
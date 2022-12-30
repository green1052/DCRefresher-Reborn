<template>
    <div class="refresher-dccon-popup">
        <p>디시콘</p>

        <div @click="close" class="close">
            <div class="cross"></div>
            <div class="cross"></div>
        </div>

        <ul style="overflow: auto; display: flex;">
            <li v-for="dccon in this.frame.dccon.list" :key="dccon.title">
                <img @click="dcconListclick(dccon.detail)" :alt="dccon.title" :src="dccon.main_img_url"/>
            </li>
        </ul>

        <hr>

        <div style="width: 100%; height: 80%; overflow: auto;">
            <ul>
                <li v-for="dccon in this.currentDccon ?? this.frame.dccon.list[0].detail" @click="dcconClick(dccon)"
                    style="float: left;">
                    <img :alt="dccon.title" :src="dccon.list_img"/>
                </li>
            </ul>
        </div>
    </div>
</template>

<script lang="ts">
import Vue, {PropType} from "vue";

interface DcconPopupData {
    currentDccon: DcinsideDccon[] | null;
}

export default Vue.extend({
    name: "refresher-dccon-popup",
    props: {
        frame: {
            type: Object as PropType<RefresherFrame>,
            required: true
        }
    },
    data: (): DcconPopupData => {
        return {
            currentDccon: null
        }
    },
    methods: {
        dcconListclick(dccons: DcinsideDccon[]) {
            this.currentDccon = dccons;
        },
        dcconClick(dccon: DcinsideDccon) {
            this.$emit("clickDccon", dccon);
        },
        close() {
            this.$emit("closeDccon");
        }
    }
});
</script>
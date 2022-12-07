import Vue from "vue";
import refresher from "../views/components/refresher.vue";

new Vue({
    el: "#app",
    render: h => h(refresher, {
        props: {
            RefresherVersion: (document.querySelector("#RefresherVersion") as HTMLInputElement).value,
            RefresherDevMode: (document.querySelector("#RefresherDevMode") as HTMLInputElement).value === "true"
        }
    })
});
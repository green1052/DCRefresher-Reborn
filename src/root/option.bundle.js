import Vue from "vue";
import refresher from "../views/components/refresher";

document.addEventListener("DOMContentLoaded", () => {
    new Vue({
        el: "#app",
        render: h => h(refresher, {
            props: {
                RefresherVersion: document.querySelector("#RefresherVersion").value,
                RefresherDevMode: document.querySelector("#RefresherDevMode").value === "true"
            }
        })
    });
});
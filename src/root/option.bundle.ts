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

const key = "ArrowUpArrowUpArrowDownArrowDownArrowLeftArrowRightArrowLeftArrowRightba";

let input = "";

document.addEventListener("keydown", (e) => {
    input += e.key;

    if (input === key) {
        window.open("https://youtu.be/dQw4w9WgXcQ", "_blank");
        return;
    }

    if (key.indexOf(input))
        input = e.key;
});
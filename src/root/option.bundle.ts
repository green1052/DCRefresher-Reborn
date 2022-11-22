import Vue from "vue";
import refresher from "../views/components/refresher.vue";
import browser from "webextension-polyfill";

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
        browser.tabs.create({
            url: "https://youtu.be/dQw4w9WgXcQ"
        });

        return;
    }

    if (key.indexOf(input))
        input = e.key;
});
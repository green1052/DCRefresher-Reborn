import {defineComponent, h} from "vue";

export const PlusIcon = defineComponent({
    name: "PlusIcon",
    render() {
        return h("svg", {
            fill: "var(--refresher-text)",
            height: "18px",
            viewBox: "0 0 24 24",
            width: "18px",
            xmlns: "http://www.w3.org/2000/svg"
        }, [
            h("path", {d: "M0 0h24v24H0z", fill: "none"}),
            h("path", {d: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"})
        ]);
    }
});

export const RemoveIcon = defineComponent({
    name: "RemoveIcon",
    render() {
        return h("svg", {
            fill: "var(--refresher-text)",
            height: "14",
            viewBox: "0 0 18 18",
            width: "14",
            xmlns: "http://www.w3.org/2000/svg"
        }, [
            h("path", {d: "M14.53 4.53l-1.06-1.06L9 7.94 4.53 3.47 3.47 4.53 7.94 9l-4.47 4.47 1.06 1.06L9 10.06l4.47 4.47 1.06-1.06L10.06 9z"})
        ]);
    }
});
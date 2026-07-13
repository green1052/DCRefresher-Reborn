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

export const RefreshIcon = defineComponent({
    name: "RefreshIcon",
    render() {
        return h("svg", {
            class: "clickable-icon",
            fill: "var(--refresher-text)",
            height: "12px",
            viewBox: "0 0 30 30",
            width: "12px",
            xmlns: "http://www.w3.org/2000/svg"
        }, [
            h("path", {d: "M 15 3 C 12.031398 3 9.3028202 4.0834384 7.2070312 5.875 A 1.0001 1.0001 0 1 0 8.5058594 7.3945312 C 10.25407 5.9000929 12.516602 5 15 5 C 20.19656 5 24.450989 8.9379267 24.951172 14 L 22 14 L 26 20 L 30 14 L 26.949219 14 C 26.437925 7.8516588 21.277839 3 15 3 z M 4 10 L 0 16 L 3.0507812 16 C 3.562075 22.148341 8.7221607 27 15 27 C 17.968602 27 20.69718 25.916562 22.792969 24.125 A 1.0001 1.0001 0 1 0 21.494141 22.605469 C 19.74593 24.099907 17.483398 25 15 25 C 9.80344 25 5.5490109 21.062074 5.0488281 16 L 8 16 L 4 10 z"})
        ]);
    }
});
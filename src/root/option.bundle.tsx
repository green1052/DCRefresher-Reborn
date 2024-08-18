// import refresher from "../views/components/refresher.vue";
// import Vue from "vue";
//
// new Vue({
//     el: "#app",
//     render: (h) => h(refresher)
// });

import {createRoot} from "react-dom/client";
import React from "react";
import {App} from "../views/App";

const root = createRoot(document.querySelector("#app")!);
root.render(<App/>);
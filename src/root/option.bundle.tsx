// import refresher from "../views/components/refresher1.vue";
// import Vue from "vue";
//
// new Vue({
//     el: "#app",
//     render: (h) => h(refresher)
// });

import { createRoot } from "react-dom/client";
import Refresher from "../views/refresher";
import React from "react";

createRoot(document.getElementById("app")!).render(<Refresher />);

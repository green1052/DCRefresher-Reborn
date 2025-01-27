import "./styles/index.scss";
import {filter} from "./core/filtering";
import {modules} from "./core/modules";
import "./core/block";
import "./core/updateCheck";

window.addEventListener("DOMContentLoaded", () => {
    if (document.head.children.length > 0) return;

    const h2 = document.createElement("h2");
    h2.innerText = "과도한 요청 혹은 모종의 이유로 인해 서버 측으로부터 IP 차단을 당했습니다.\n\n해결법\n1. IP 변경\n2. 캐시 비활성화 옵션 비활성화\n3. 새로고침 주기 늘리기\n\n이 메시지가 계속해서 나타난다면, DCRefresher Reborn GitHub나 Discord에 문의해주세요.";
    document.body.appendChild(h2);
});

console.log("🍊⚓ Initializing DCRefresher Reborn.");

const loadStart = performance.now();

const context = require.context("./modules/", true, /\.ts$/);

Promise
    .all(context.keys().map((v) => modules.load(context(v).default)))
    .then(() => {
        const took = (performance.now() - loadStart).toFixed(2);
        console.log(`🍊✔️ DCRefresher Reborn Module Loaded. took ${took}ms.`);
        filter.run();
    });
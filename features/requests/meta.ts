import {Gauge} from "lucide-react";

import {defineModuleMeta} from "@/core/module/define";

export default defineModuleMeta({
    id: "requests",
    name: "요청 제한",
    description: "디시인사이드로 한꺼번에 보내는 요청 수를 제한합니다. 요청이 몰려 차단되는 것을 막습니다.",
    icon: Gauge,

    settings: {
        concurrency: {
            type: "range",
            name: "동시 요청 수",
            desc: "이 페이지에서 한 번에 보내는 요청의 최대 개수입니다. 넘치는 요청은 앞의 요청이 끝날 때까지 기다립니다.",
            default: 4,
            min: 1,
            max: 10,
            step: 1,
            unit: "개"
        }
    }
});

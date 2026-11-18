import preact from "@preact/preset-vite";
import {defineConfig} from "vitest/config";
import {WxtVitest} from "wxt/testing/vitest-plugin";

/**
 * 단위 테스트 모음 (bun run test). WxtVitest가 wxt.config.ts의 vite 설정, @/ 별칭, import.meta.env.BROWSER 같은 환경을 맞춰 주고
 * 확장 API(browser.*)를 @webext-core/fake-browser(메모리 storage 등)로 바꾼다. E2E는 playwright.config.ts를 본다.
 * WxtVitest는 wxt.config.ts의 vite 플러그인을 물려주지 않으므로 preact 프리셋을 직접 달아 테스트도 빌드처럼 preact/compat으로 돌린다.
 */
export default defineConfig({
    plugins: [WxtVitest(), preact()],
    test: {
        include: ["tests/unit/**/*.test.{ts,tsx}"],
        // 파서, 대화, 목록 교체처럼 DOM을 만지는 코드가 많아 jsdom을 기본으로 쓴다.
        environment: "jsdom",
        // 파일마다 워커를 다시 띄우지 않고 vm 컨텍스트만 새로 만들어 jsdom 준비가 빠르다 (4.6초→2.6초).
        // 다만 Node 내장 모듈(fs 등 얼개 류)은 realm이 달라 instanceof Error가 아닐 수 있다. 그런 패턴이 생기면 이 줄을 지운다.
        pool: "vmThreads",
        setupFiles: ["tests/setup.ts"],
        mockReset: true,
        restoreMocks: true,
        server: {
            deps: {
                // vitest는 기본으로 node_modules 패키지를 외부화해 별칭을 안 태운다. react를 부르는 패키지는
                // 변환해야 react→preact/compat 별칭(preact 프리셋)이 걸린다. react는 lucide-react의 peer로 bun이 자동 설치해 물리로 남아 있다.
                inline: [/zustand/, /lucide-react/]
            }
        }
    }
});

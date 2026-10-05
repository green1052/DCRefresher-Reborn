import {existsSync, readdirSync} from "node:fs";
import {resolve} from "node:path";

/**
 * file(index.ts·meta.ts·page.css 등)이 있는 기능 모듈 폴더 이름 (features/<폴더>), 이름순.
 * WXT는 modules/ 바로 아래 파일만 모듈로 불러오므로 빌드 모듈들이 같이 쓰는 이 도우미는 하위 폴더에 둔다.
 */
export const featureFolders = (root: string, file: string): string[] => {
    const dir = resolve(root, "features");
    return readdirSync(dir, {withFileTypes: true})
        .filter((entry) => entry.isDirectory() && existsSync(resolve(dir, entry.name, file)))
        .map((entry) => entry.name)
        .sort();
};

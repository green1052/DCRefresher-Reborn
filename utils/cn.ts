// 빌드에서 "cn"을 이 파일로 바꾼다 (wxt.config.ts의 별칭). 테스트는 전체 표를 쓰는 "cn" 그대로다.
import {createCn} from "cn/engine";

import tables from "./cn-tables";

export const cn = createCn(tables);

// 오버레이 shadow에 넣는 CSS. 공용 스타일 다음에 기능별 스타일(features/<id>/overlay.css)을 넣는다.
// 콘텐츠 스크립트가 불러오는 CSS는 오버레이 shadow에만 들어간다 (cssInjectionMode: "ui").
// 기능별 스타일은 따로 둔 파일에서 불러온다. 같은 파일에 import.meta.glob을 쓰면 그 import가 파일 맨 위로 올라가 공용 스타일보다 앞에 들어간다.
import "@/assets/styles/tailwind.css";
import "@/assets/styles/overlay.css";
import "./feature-styles";

// 기능별 오버레이 스타일 (features/<id>/overlay.css). styles.ts가 공용 스타일 다음에 불러온다.
import.meta.glob("../../features/*/overlay.css", {eager: true});

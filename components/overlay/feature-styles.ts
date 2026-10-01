// 기능별 오버레이 스타일 (features/<id>/overlay.scss). styles.ts가 공용 스타일 다음에 불러온다.
import.meta.glob("../../features/*/overlay.scss", {eager: true});

/**
 * shadcn 부품의 포커스 링(components/ui/button.tsx의 buttonVariants와 같은 값)만 떼어 쓴다.
 * 목록 줄·댓글처럼 수백~수천 번 그리는 자리에서는 Base UI Button을 쓰지 않는다 (버튼마다 리스너를 여럿 단다).
 * 그래도 키보드 포커스 표시는 있어야 하므로 이 클래스만 붙인다. 모양(크기·정렬·말줄임)은 쓰는 쪽이 정한다.
 */
export const FOCUS_RING = "cursor-pointer rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

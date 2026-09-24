import type {GalleryPreData, PostInfo} from "@/features/types";

/**
 * 모듈 간 통신에 사용되는 이벤트 맵.
 * 새 이벤트는 여기에 추가한다 (closed-world, global augmentation 없음).
 */
export interface ModuleEventMap {
    /** 설정값이 갤러리 뷰 등에서 유저 메모 갱신을 요청할 때 */
    refresherUpdateUserMemo: [];
    /** 유저 컨텍스트(닉네임 클릭 등)에서 선택된 유저 정보 */
    refresherUserContextMenu: [nick: string | null, uid: string | null, ip: string | null, dcnick: string | null, extra: string | null];
    /** 유저/디시콘 차단 요청 */
    refresherRequestBlock: [options: BlockRequestOptions];
    /** 목록에 새 게시글이 추가됐을 때 */
    newPostList: [elements: HTMLElement[]];
    /** 미리보기 대상 게시글 요소 */
    contentPreview: [element: HTMLElement];
    /** 게시글 본문 파싱 완료 */
    postDataLoaded: [post: PostInfo];
    /** 게시글의 댓글 ID 파싱 완료 */
    postCommentIdLoaded: [commentId: string | undefined, commentNo: string | undefined];
    /** 게시글 DOM 로드 */
    refresherGetPost: [document: Document];
    /** 목록 새로고침 요청 */
    refreshRequest: [];
    /** 목록에서 파싱된 게시글 정보 */
    postListParsed: [posts: GalleryPreData[]];
}

export type BlockRequestOptions = {
    target: "user" | "dccon";
    blockAllDccon?: boolean;
};

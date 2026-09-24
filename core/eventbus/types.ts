/**
 * 모듈 간 통신에 사용되는 이벤트 맵 (Emittery EventData).
 * 값이 undefined면 데이터 없는 이벤트. 새 이벤트는 여기에 추가한다.
 */
export interface ModuleEventData {
    /** 유저/디시콘 차단 요청 */
    refresherRequestBlock: BlockRequestOptions;
    /** 목록에 새 게시글이 추가됐을 때 */
    newPostList: HTMLElement[];
    /** 게시글 DOM 로드 */
    refresherGetPost: Document;
    /** 목록 새로고침 요청 */
    refreshRequest: undefined;
    /** 이미지 컨텍스트 메뉴(SauceNao) 요청 */
    imageSearch: undefined;
}

export type BlockRequestOptions = {
    target: "user" | "dccon";
    blockAllDccon?: boolean;
};

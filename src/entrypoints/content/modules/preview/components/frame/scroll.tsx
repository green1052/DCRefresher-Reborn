import {Text} from "@radix-ui/themes";

import "./scroll.scss";

interface Props {
    side: "top" | "bottom";
}

export default function ScrollIndicator({side}: Props) {
    return (
        <div className={side === "top" ? "refresher-scroll top" : "refresher-scroll"}>
            <div className="center">
                <Text as="p" size="2">
                    한번 더 스크롤 하면
                    {side === "top" ? "이전" : "다음"} 게시글을 봅니다.
                </Text>
            </div>
        </div>
    );
}

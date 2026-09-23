import {Button, Text} from "@radix-ui/themes";
import {ChevronDown, ChevronUp, ExternalLink, PencilLine, RefreshCw, Share2} from "lucide-react";

import dcconIcon from "@/assets/icons/dccon.webp?no-inline";

interface Props {
    id?: string | number;
    text?: string;
    className?: string;
    click?: () => boolean | Promise<boolean>;
}

const iconMap: Record<string, React.ComponentType<{className?: string}>> = {
    upvote: ChevronUp,
    downvote: ChevronDown,
    share: Share2,
    newtab: ExternalLink,
    write: PencilLine,
    refresh: RefreshCw
};

export default function PreviewButton({id = "", text = "", className, click}: Props) {
    const IconComp = iconMap[String(id)];
    const dcconSrc = browser.runtime.getURL(dcconIcon as never);

    const variant = className?.includes("primary") ? "solid" : className?.includes("sub") ? "soft" : "ghost";

    return (
        <Button
            className={className ? `refresher-preview-button ${className}` : "refresher-preview-button"}
            onClick={() => void click?.()}
            size="2"
            variant={variant}
        >
            {IconComp && (
                <IconComp className="refresher-preview-icon"/>
            )}
            {!IconComp && id === "dccon" && (
                <img src={dcconSrc}/>
            )}
            {text && (
                <Text
                    className="refresher-vote-text"
                    id={`refresher-${id}-counts`}
                    size="2"
                >
                    {text}
                </Text>
            )}
        </Button>
    );
}

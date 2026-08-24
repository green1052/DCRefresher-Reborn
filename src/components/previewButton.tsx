import {ChevronDown, ChevronUp, ExternalLink, PencilLine, RefreshCw, Share2} from "lucide-react";
import {useState} from "react";

import dcconIcon from "@/assets/icons/dccon.webp?no-inline";

import "./previewButton.scss";

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
    const [error, setError] = useState(0);

    const IconComp = iconMap[String(id)];
    const dcconSrc = browser.runtime.getURL(dcconIcon as never);

    const safeClick = async (): Promise<boolean> => {
        if (!click) return false;

        const result = await click();

        if (!result) {
            setError(Math.random());
        }

        return result;
    };

    return (
        <div
            className={className ? `refresher-preview-button ${className}` : "refresher-preview-button"}
            onClick={() => void safeClick()}
        >
            {IconComp && (
                <IconComp className="refresher-preview-icon"/>
            )}
            {!IconComp && id === "dccon" && (
                <img src={dcconSrc}/>
            )}
            {text && (
                <p
                    className="refresher-vote-text"
                    id={`refresher-${id}-counts`}
                >
                    {text}
                </p>
            )}
        </div>
    );
}

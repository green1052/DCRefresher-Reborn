import PreviewButton from "@/components/previewButton";

import "./frameVotes.scss";

interface Props {
    upvotes?: string;
    fixedUpvotes?: string;
    downvotes?: string;
    disabledDownvote?: boolean;
    upvote: () => Promise<boolean>;
    downvote: () => Promise<boolean>;
    share: () => Promise<boolean>;
    original: () => Promise<boolean>;
}

export default function FrameVotes({
    upvotes,
    fixedUpvotes,
    downvotes,
    disabledDownvote,
    upvote,
    downvote,
    share,
    original
}: Props) {
    const base = upvotes ?? "X";
    const upvoteText = fixedUpvotes === undefined ? base : `${base} (${fixedUpvotes})`;

    return (
        <div className="refresher-preview-votes">
            <div>
                <PreviewButton
                    click={upvote}
                    className="refresher-upvote"
                    id="upvote"
                    text={upvoteText}
                />
                {!disabledDownvote && (
                    <PreviewButton
                        click={downvote}
                        className="refresher-downvote"
                        id="downvote"
                        text={downvotes ?? "X"}
                    />
                )}
                <PreviewButton
                    click={share}
                    className="refresher-share"
                    id="share"
                />
                <PreviewButton
                    click={original}
                    id="newtab"
                />
            </div>
        </div>
    );
}

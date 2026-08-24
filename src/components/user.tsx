import eventBus from "@/core/eventbus";
import {User} from "@/utils/user";

import "./user.scss";

interface Props {
    user: User;
    me?: boolean;
    click?: (user: User) => void;
}

export default function UserComponent({user, me = false, click}: Props) {
    const userDescription = (() => {
        if (!user.id && !user.ip) return "";

        if (user.isMember()) {
            const ban = user.ban;
            const ratio = user.ratio;

            return `${ban ? `[${ban}] ` : ""}${ratio ? ` [${ratio}] ` : ""}(${user.id})`;
        }

        return `(${user.ip})${user.ip_data ? ` [${user.ip_data}]` : ""}`;
    })();

    const clickHandle = (): void => {
        if (typeof click === "function") {
            click(user);
            return;
        }

        if (user.id) {
            window.open(`https://gallog.dcinside.com/${user.id}`, "_blank");
        }
    };

    const contextMenu = (): void => {
        eventBus.emit("refresherUserContextMenu", user.nick, user.id, user.ip, null, null);
    };

    return (
        <div
            className={user.id ? "refresher-user cursor" : "refresher-user"}
            data-me={me}
            onClick={clickHandle}
            onContextMenu={contextMenu}
            title={userDescription}
        >
            <div className="refresher-user-content">
                <span
                    className="refresher-user-icon"
                    data-icon={user.icon}
                    data-type={user.type}
                />
                <span className="refresher-user-nick">{user.nick}</span>
                {user.memo && (
                    <span
                        className="refresher-user-memo"
                        style={{color: user.memo.color}}
                    >
                        [{user.memo.text}]
                    </span>
                )}
                {!(me && user.isLogout()) && (
                    <span className="refresher-user-info">
                        {userDescription}
                    </span>
                )}
            </div>
        </div>
    );
}

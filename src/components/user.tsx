import {Flex, Text} from "@radix-ui/themes";
import eventBus from "@/core/eventbus";
import {User} from "@/utils/user";

interface Props {
    user: User;
    me?: boolean;
    click?: (user: User) => void;
}

// 고정/부고정/매니저 등 유저 타입별 아이콘 점 색
const ICON_COLORS: Record<string, string> = {
    UNFIXED: "var(--gray-3)",
    HALF_FIXED: "var(--gray-9)",
    FIXED: "var(--yellow-9)",
    HALF_FIXED_SUB_MANAGER: "var(--blue-9)",
    FIXED_SUB_MANAGER: "var(--blue-9)",
    HALF_FIXED_MANAGER: "var(--orange-9)",
    FIXED_MANAGER: "var(--orange-9)"
};

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
        eventBus.emit("refresherUserContextMenu", {
            nick: user.nick,
            id: user.id,
            ip: user.ip,
            code: null,
            packageIdx: null
        });
    };

    return (
        <Flex
            align="center"
            className={user.id ? "refresher-user cursor" : "refresher-user"}
            data-me={me}
            gap="1"
            onClick={clickHandle}
            onContextMenu={contextMenu}
            style={{
                maxWidth: "calc(100% - 170px)",
                ...(me ? {background: "var(--accent-a6)", borderRadius: 5, color: "white"} : {})
            }}
            title={userDescription}
        >
            <span
                style={{
                    background: ICON_COLORS[user.type ?? "UNFIXED"] ?? "var(--gray-3)",
                    borderRadius: "50%",
                    boxShadow: "var(--shadow-3)",
                    display: "block",
                    flexShrink: 0,
                    height: 9,
                    width: 9
                }}
            />
            <Text className="refresher-user-nick" size="2" style={{whiteSpace: "nowrap"}} weight="bold">
                {user.nick}
            </Text>
            {user.memo && (
                <Text size="1" style={{color: user.memo.color, whiteSpace: "nowrap"}}>
                    [{user.memo.text}]
                </Text>
            )}
            {!(me && user.isLogout()) && (
                <Text
                    className="refresher-user-info"
                    color="gray"
                    size="1"
                    style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    {userDescription}
                </Text>
            )}
        </Flex>
    );
}

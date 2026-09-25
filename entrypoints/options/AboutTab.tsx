import {Badge, Box, Button, Flex, Grid, Heading, Text} from "@radix-ui/themes";
import {BookOpen, Bug, Code, Heart, type LucideIcon, MessageCircle, Star, Tag, Users} from "lucide-react";
import {Section} from "./Layout";

const REPO = "https://github.com/green1052/DCRefresher-Reborn";

const STORE = import.meta.env.FIREFOX
    ? "https://addons.mozilla.org/ko/firefox/addon/dcrefresher-reborn"
    : "https://chrome.google.com/webstore/detail/dcrefresher-reborn/pmfifcbendahnkeojgpfppklgioemgon";

const LINKS: [string, string, LucideIcon][] = [
    ["위키", `${REPO}/wiki`, BookOpen],
    ["버그 제보 / 문의", `${REPO}/issues`, Bug],
    ["업데이트 내역", `${REPO}/releases`, Tag],
    ["GitHub", REPO, Code],
    ["리프레셔 갤러리", "https://gall.dcinside.com/mini/board/lists/?id=bjwg64", Users],
    ["Discord", "https://discord.gg/SSW6Zuyjz6", MessageCircle],
    ["리뷰 남기기", STORE, Star],
    ["후원", "https://www.buymeacoffee.com/green1052", Heart]
];

export function AboutTab({logo, version}: { logo: string; version: string }) {
    return (
        <Box>
            <Section>
                <Flex align="center" gap="4">
                    <img src={logo} alt="" width={64} height={64} style={{borderRadius: "var(--radius-4)"}}/>
                    <Box>
                        <Flex align="center" gap="2">
                            <Heading size="5">DCRefresher Reborn</Heading>
                            <Badge variant="soft">v{version}</Badge>
                        </Flex>
                        <Text as="p" size="2" color="gray">디시인사이드 개선 확장 프로그램</Text>
                    </Box>
                </Flex>
            </Section>

            <Section title="바로가기">
                <Grid columns={{initial: "1", sm: "2"}} gap="2">
                    {LINKS.map(([label, url, Icon]) => (
                        <Button key={label} asChild variant="soft" color="gray" style={{justifyContent: "flex-start"}}>
                            <a href={url} target="_blank" rel="noreferrer">
                                <Icon size={14}/> {label}
                            </a>
                        </Button>
                    ))}
                </Grid>
            </Section>
        </Box>
    );
}

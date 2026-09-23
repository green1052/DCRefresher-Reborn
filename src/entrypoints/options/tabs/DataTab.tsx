import {Button, Card, Flex, Heading, Text} from "@radix-ui/themes";
import {useEffect} from "react";

import {useAppContext} from "../../popup/context";

export default function DataTab() {
    const {data} = useAppContext();
    const {lastUpdate, loading, refreshLastUpdate, backupCloud, recoverCloud, exportData, importData, clearData} = data;

    useEffect(() => {
        void refreshLastUpdate();
    }, [refreshLastUpdate]);

    return (
        <Card size="2">
            <Flex direction="column" gap="4" mt="4">
                <Heading size="3">데이터 관리</Heading>

                <Flex gap="3">
                    <Button disabled={loading} onClick={() => void backupCloud()} variant="soft">
                        클라우드 백업
                    </Button>
                    <Button disabled={loading} onClick={() => void recoverCloud()} variant="soft">
                        클라우드 복원
                    </Button>
                </Flex>

                {lastUpdate > 0 && (
                    <Text color="gray" size="1">
                        마지막 백업: {new Date(lastUpdate).toLocaleString()}
                    </Text>
                )}

                <Flex gap="3">
                    <Button disabled={loading} onClick={() => void exportData()} variant="soft">
                        데이터 내보내기
                    </Button>
                    <Button disabled={loading} onClick={() => void importData()} variant="soft">
                        데이터 가져오기
                    </Button>
                    <Button color="red" disabled={loading} onClick={() => void clearData()} variant="soft">
                        ⚠️ 데이터 초기화 ⚠️
                    </Button>
                </Flex>
            </Flex>
        </Card>
    );
}

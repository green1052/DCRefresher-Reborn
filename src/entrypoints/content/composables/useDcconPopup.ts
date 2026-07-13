import {type App, type ComponentPublicInstance, createApp, onBeforeUnmount, ref} from "vue";

import RefresherDcconPopup from "@/components/dccon.vue";

interface UseDcconPopupReturn {
    dccon: ReturnType<typeof ref<DcinsideDccon[]>>;
    bigDccon: ReturnType<typeof ref<boolean>>;
    renderDcconPopup: () => boolean;
    clickDccon: (selectedDccon: DcinsideDccon[], selectedBigDccon: boolean) => void;
    closeDccon: () => void;
    setDccon: (value: DcinsideDccon[]) => void;
    setBigDccon: (value: boolean) => void;
    getDccon: () => DcinsideDccon[];
    getBigDccon: () => boolean;
}

export function useDcconPopup(): UseDcconPopupReturn {
    const dccon = ref<DcinsideDccon[]>([]);
    const bigDccon = ref(false);
    const dcconRender = ref<ComponentPublicInstance | null>(null);
    const dcconApp = ref<App<Element> | null>(null);

    const closeDccon = () => {
        if (!dcconApp.value) return;

        const container = dcconRender.value?.$el?.parentElement;
        dcconApp.value.unmount();
        if (container) container.remove();
        dcconApp.value = null;
        dcconRender.value = null;
    };

    const clickDccon = (selectedDccon: DcinsideDccon[], selectedBigDccon: boolean) => {
        dccon.value = selectedDccon;
        bigDccon.value = selectedBigDccon;
        closeDccon();
    };

    const renderDcconPopup = (): boolean => {
        if (dcconApp.value) return false;

        const element = document.createElement("div");
        document.body.appendChild(element);

        const app = createApp(RefresherDcconPopup, {
            onClickDccon: clickDccon,
            onCloseDccon: closeDccon
        });

        dcconApp.value = app;
        dcconRender.value = app.mount(element);

        return true;
    };

    const setDccon = (value: DcinsideDccon[]) => {
        dccon.value = value;
    };

    const setBigDccon = (value: boolean) => {
        bigDccon.value = value;
    };

    const getDccon = () => dccon.value;

    const getBigDccon = () => bigDccon.value;

    onBeforeUnmount(() => {
        closeDccon();
    });

    return {
        dccon,
        bigDccon,
        renderDcconPopup,
        clickDccon,
        closeDccon,
        setDccon,
        setBigDccon,
        getDccon,
        getBigDccon
    };
}
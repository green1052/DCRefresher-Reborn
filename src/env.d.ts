declare module "*.vue" {
    import type {DefineComponent} from "vue";
    const component: DefineComponent<object, object, unknown>;
    export default component;
}

declare module "@/components/toast.vue" {
    import type {DefineComponent} from "vue";
    export type ToastLevel = "info" | "error" | "warning" | "cake";
    const component: DefineComponent<object, object, unknown>;
    export default component;
}

declare module "*.webp" {
    const src: string;
    export default src;
}

declare module "*.webp?no-inline" {
    const src: string;
    export default src;
}

declare module "*.png" {
    const src: string;
    export default src;
}

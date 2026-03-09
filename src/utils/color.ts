export const random = () => `#${Math.random().toString(16).slice(2, 8).padStart(6, '0')}`;

export default {
    random
};
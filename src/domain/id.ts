export const uid = (): string => crypto.randomUUID().replaceAll('-', '').slice(0, 12);

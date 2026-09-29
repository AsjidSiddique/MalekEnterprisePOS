/* Demo-mode replacement for "firebase/app". */
const app = { demo: true };
export const getApps = () => [app];
export const getApp = () => app;
export const initializeApp = () => app;

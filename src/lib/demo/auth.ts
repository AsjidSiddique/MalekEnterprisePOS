/* Demo-mode replacement for "firebase/auth": any email and password signs in as an admin. */
type Listener = (u: DemoUser | null) => void;

export interface DemoUser {
  uid: string; email: string;
  getIdToken: () => Promise<string>;
  getIdTokenResult: () => Promise<{ claims: { admin: boolean } }>;
}

const KEY = "malek-demo-user";
const listeners = new Set<Listener>();
let current: DemoUser | null = null;

const makeUser = (email: string): DemoUser => ({ uid: "demo-admin", email, getIdToken: async () => "demo-token", getIdTokenResult: async () => ({ claims: { admin: true } }) });

if (typeof window !== "undefined") {
  const saved = window.sessionStorage.getItem(KEY);
  if (saved) current = makeUser(saved);
}

const notify = () => listeners.forEach((l) => l(current));
const auth = { get currentUser() { return current; } };

export const getAuth = () => auth;
export function onAuthStateChanged(_a: unknown, cb: Listener) {
  listeners.add(cb);
  setTimeout(() => cb(current), 150);
  return () => { listeners.delete(cb); };
}
export async function signInWithEmailAndPassword(_a: unknown, email: string) {
  await new Promise((r) => setTimeout(r, 500));
  current = makeUser(email || "admin@malek.example");
  window.sessionStorage.setItem(KEY, current.email);
  notify();
  return { user: current };
}
export async function signOut() { current = null; window.sessionStorage.removeItem(KEY); notify(); }

/* Demo-mode replacement for "firebase/storage": uploads are simulated and nothing leaves the browser. */
export const getStorage = () => ({ demo: true });
export const ref = (_s: unknown, path: string) => ({ fullPath: path });
export async function deleteObject() { await new Promise((r) => setTimeout(r, 60)); }

export function uploadBytesResumable(_ref: unknown, file: { size: number }) {
  return {
    on(_evt: string, next: (s: { bytesTransferred: number; totalBytes: number }) => void, _err: (e: Error) => void, done: () => void) {
      const total = Math.max(file.size, 1);
      let sent = 0;
      const step = Math.max(total / 24, 1);
      const timer = setInterval(() => {
        sent = Math.min(total, sent + step);
        next({ bytesTransferred: sent, totalBytes: total });
        if (sent >= total) { clearInterval(timer); done(); }
      }, 110);
    },
  };
}

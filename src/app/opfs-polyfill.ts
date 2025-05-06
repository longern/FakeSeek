(() => {
  if (typeof window.FileSystemFileHandle === "undefined") return;
  if ("createWritable" in window.FileSystemFileHandle.prototype) return;

  const worker = new Worker(
    new URL("./opfs-polyfill-worker.js", import.meta.url)
  );

  const pending = new Map();
  worker.onmessage = ({ data }) => {
    const { id, result, error } = data;
    const { res, rej } = pending.get(id) || {};
    pending.delete(id);
    error ? rej(new DOMException(error, "InvalidStateError")) : res(result);
  };

  const call = <T>(objId: string | null, cmd: string, arg?: any) => {
    const id = crypto.randomUUID();
    worker.postMessage({ id, cmd, arg, objId });
    return new Promise<T>((res, rej) => pending.set(id, { res, rej }));
  };

  // @ts-ignore
  window.FileSystemFileHandle.prototype.createWritable = async function (
    opts?: FileSystemCreateWritableOptions
  ) {
    const initId = crypto.randomUUID();
    const root = await navigator.storage.getDirectory();
    const path = await root.resolve(this);
    if (!path) throw new Error("Failed to resolve file handle");
    worker.postMessage({ id: initId, cmd: "INIT", arg: opts, path });
    const accessId = await new Promise<string>((res, rej) =>
      pending.set(initId, { res, rej })
    );

    return {
      write: (chunk: FileSystemWriteChunkType) =>
        call(accessId, "WRITE", chunk),
      seek: (offset: number) => call<void>(accessId, "SEEK", offset),
      truncate: (size: number) => call(accessId, "TRUNCATE", size),
      close: () => call(accessId, "CLOSE"),
      abort: () => call(accessId, "CLOSE"),
      locked: true,
      getWriter: () => {
        throw new TypeError("getWriter is not supported");
      },
    };
  };
})();

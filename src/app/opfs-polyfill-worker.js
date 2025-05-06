let accessHandles = {},
  pos = 0;

self.onmessage = async (e) => {
  const { id, objId, cmd, arg, path } = e.data;

  try {
    if (cmd === "INIT") {
      const root = await navigator.storage.getDirectory();
      const basepath = path.slice(0, path.length - 1);
      const filename = path[path.length - 1];
      const basedir = await basepath.reduce(
        (dir, name) => dir.getDirectoryHandle(name),
        root
      );
      const handle = await basedir.getFileHandle(filename);
      const access = await handle.createSyncAccessHandle();
      const accessId = crypto.randomUUID();
      accessHandles[accessId] = access;
      access.truncate(0);
      pos = 0;
      self.postMessage({ id, result: accessId });
      return;
    }

    if (cmd === "WRITE") {
      let data = arg?.data ?? arg;
      let at =
        typeof arg === "object" && arg?.position >= 0 ? arg.position : pos;
      if (!(data instanceof Uint8Array)) data = new TextEncoder().encode(data);
      const access = accessHandles[objId];
      access.write(data, { at });
      pos = at + data.byteLength;
      self.postMessage({ id, result: data.byteLength });
      return;
    }

    if (cmd === "SEEK") {
      pos = arg;
      self.postMessage({ id, result: pos });
      return;
    }

    if (cmd === "TRUNCATE") {
      const access = accessHandles[objId];
      access.truncate(arg);
      if (pos > arg) pos = arg;
      self.postMessage({ id });
      return;
    }

    if (cmd === "CLOSE") {
      const access = accessHandles[objId];
      access.flush();
      access.close();
      self.postMessage({ id });
      delete accessHandles[objId];
      return;
    }
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};

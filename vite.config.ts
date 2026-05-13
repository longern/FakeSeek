import path from "path";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

async function collectFiles(dir: string, root = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(absolutePath, root);
      return [path.relative(root, absolutePath).split(path.sep).join("/")];
    }),
  );

  return files.flat();
}

function serviceWorkerPrecachePlugin(): Plugin {
  return {
    name: "fakeseek-service-worker-precache",
    apply: "build",
    async closeBundle() {
      const distDir = path.resolve(__dirname, "dist");
      const serviceWorkerPath = path.join(distDir, "service-worker.js");
      const files = (await collectFiles(distDir))
        .filter((file) => file !== "service-worker.js")
        .sort();
      const urls = ["./", ...files.map((file) => `./${file}`)];
      const versionHash = createHash("sha256")
        .update(urls.join("\n"))
        .digest("hex")
        .slice(0, 12);

      const source = await readFile(serviceWorkerPath, "utf8");
      await writeFile(
        serviceWorkerPath,
        source
          .replace(
            'const CACHE_VERSION = "fakeseek-static-dev";',
            `const CACHE_VERSION = "fakeseek-static-${versionHash}";`,
          )
          .replace(
            'const PRECACHE_URLS = ["./", "./index.html", "./manifest.json", "./logo.png"];',
            `const PRECACHE_URLS = ${JSON.stringify(urls, null, 2)};`,
          ),
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorkerPrecachePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "https://research.longern.com",
        changeOrigin: true,
      },
    },
  },
});

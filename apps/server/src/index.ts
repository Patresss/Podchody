import { createApp } from "./app.js";
import { closeMetadataReader } from "./image-service.js";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../../../", import.meta.url));
process.env.APP_ROOT = appRoot;

try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const { app, config } = await createApp();
const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`Podchody działają na http://0.0.0.0:${config.port}`);
});

async function shutdown() {
  server.close();
  await closeMetadataReader();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

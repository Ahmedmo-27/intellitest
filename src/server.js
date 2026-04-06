import "dotenv/config";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";

const port = Number(process.env.PORT) || 3000;
const app = createApp();

app.listen(port, () => {
  logger.info("server_listening", { port, provider: process.env.LLM_PROVIDER || "ollama" });
});

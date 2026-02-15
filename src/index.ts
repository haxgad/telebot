import { createBot } from "./bot.js";
import { startScheduler } from "./scheduler.js";
import { loadConfig } from "./config.js";

async function main() {
  console.log("Starting Telegram Calendar Bot...");

  // Validate config exists
  try {
    loadConfig();
  } catch (error) {
    console.error("Configuration error:", error);
    console.error("Please create config.json from config.example.json");
    process.exit(1);
  }

  const bot = createBot();

  // Start scheduler
  startScheduler(bot);

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    await bot.stop();
    console.log("Bot stopped successfully");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Start bot with polling
  console.log("Bot is starting...");
  await bot.start({
    onStart: (botInfo) => {
      console.log(`Bot @${botInfo.username} is running!`);
    },
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

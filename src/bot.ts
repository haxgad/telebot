import { Bot, Context } from "grammy";
import { loadConfig, isUserAllowed, getUserConfig } from "./config.js";
import { getEventsForDay, getAuthUrl, listCalendars } from "./calendar.js";
import { formatEventsMessage } from "./format.js";

export function createBot(): Bot {
  const config = loadConfig();
  const bot = new Bot(config.telegram.botToken);

  // Middleware: check if user is allowed
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (!isUserAllowed(userId)) {
      await ctx.reply("Sorry, you're not authorized to use this bot.");
      return;
    }

    await next();
  });

  // /start command
  bot.command("start", async (ctx) => {
    const userConfig = getUserConfig(ctx.from!.id);
    const name = userConfig?.name || "there";

    await ctx.reply(
      `Hi ${name}! I'm your calendar bot.\n\n` +
        "Commands:\n" +
        "/today - View today's events\n" +
        "/tomorrow - View tomorrow's events\n" +
        "/setup - Link your Google Calendar\n" +
        "/calendars - Choose which calendars to show"
    );
  });

  // Helper to fetch and send events for a given day
  async function sendEventsForDay(
    ctx: Context,
    dayOffset: 0 | 1,
    label: "Today" | "Tomorrow"
  ) {
    const userId = ctx.from!.id;
    const userConfig = getUserConfig(userId);

    if (!userConfig?.googleRefreshToken) {
      await ctx.reply(
        "You haven't linked your Google Calendar yet. Use /setup to get started."
      );
      return;
    }

    const targetDate = new Date();
    if (dayOffset === 1) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    try {
      const events = await getEventsForDay(userId, targetDate);
      const message = formatEventsMessage(
        events,
        targetDate,
        label,
        userConfig.timezone
      );
      await ctx.reply(message);
    } catch (error) {
      console.error("Failed to fetch events:", error);
      await ctx.reply(
        "Failed to fetch events. Please try again or use /setup to re-link your calendar."
      );
    }
  }

  // /today command
  bot.command("today", (ctx) => sendEventsForDay(ctx, 0, "Today"));

  // /tomorrow command
  bot.command("tomorrow", (ctx) => sendEventsForDay(ctx, 1, "Tomorrow"));

  // /setup command - start OAuth flow
  bot.command("setup", async (ctx) => {
    const userId = ctx.from!.id;
    const authUrl = getAuthUrl(userId);

    await ctx.reply(
      "Click the link below to connect your Google Calendar:\n\n" +
        authUrl +
        "\n\n" +
        "After authorizing, you'll receive a code. " +
        "For now, you'll need to manually add your refresh token to the config file."
    );
  });

  // /calendars command - show available calendars
  bot.command("calendars", async (ctx) => {
    const userId = ctx.from!.id;
    const userConfig = getUserConfig(userId);

    if (!userConfig?.googleRefreshToken) {
      await ctx.reply("Please use /setup first to link your Google Calendar.");
      return;
    }

    try {
      const calendars = await listCalendars(userId);

      let message = "Your available calendars:\n\n";
      for (const cal of calendars) {
        message += `• ${cal.name}\n  ID: \`${cal.id}\`\n\n`;
      }
      message +=
        "To select calendars, update the 'calendars' array in config.json with the IDs you want.";

      await ctx.reply(message, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Failed to list calendars:", error);
      await ctx.reply("Failed to fetch calendars. Please try /setup again.");
    }
  });

  return bot;
}

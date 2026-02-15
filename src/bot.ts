import { Bot, InlineKeyboard, Context } from "grammy";
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
        "/cal - View today's or tomorrow's events\n" +
        "/setup - Link your Google Calendar\n" +
        "/calendars - Choose which calendars to show"
    );
  });

  // /cal command - show inline buttons
  bot.command("cal", async (ctx) => {
    const userConfig = getUserConfig(ctx.from!.id);

    if (!userConfig?.googleRefreshToken) {
      await ctx.reply(
        "You haven't linked your Google Calendar yet. Use /setup to get started."
      );
      return;
    }

    const keyboard = new InlineKeyboard()
      .text("Today", "cal:today")
      .text("Tomorrow", "cal:tomorrow");

    await ctx.reply("Which day?", { reply_markup: keyboard });
  });

  // Handle calendar button callbacks
  bot.callbackQuery(/^cal:(today|tomorrow)$/, async (ctx) => {
    await ctx.answerCallbackQuery();

    const userId = ctx.from.id;
    const userConfig = getUserConfig(userId);

    if (!userConfig) {
      await ctx.editMessageText("User configuration not found.");
      return;
    }

    const match = ctx.callbackQuery.data.match(/^cal:(today|tomorrow)$/);
    const dayChoice = match?.[1] as "today" | "tomorrow";

    const now = new Date();
    const targetDate = new Date(now);

    if (dayChoice === "tomorrow") {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    try {
      await ctx.editMessageText("Fetching events...");

      const events = await getEventsForDay(userId, targetDate);
      const label = dayChoice === "today" ? "Today" : "Tomorrow";
      const message = formatEventsMessage(
        events,
        targetDate,
        label,
        userConfig.timezone
      );

      await ctx.editMessageText(message);
    } catch (error) {
      console.error("Failed to fetch events:", error);
      await ctx.editMessageText(
        "Failed to fetch events. Please try again or use /setup to re-link your calendar."
      );
    }
  });

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

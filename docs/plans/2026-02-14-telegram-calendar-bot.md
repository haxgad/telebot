# Telegram Calendar Bot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Telegram bot that shows Google Calendar events on demand and sends daily evening notifications.

**Architecture:** Long-running Node.js process using grammy for Telegram polling, googleapis for calendar access, and node-cron for scheduled notifications. Config stored in a gitignored JSON file.

**Tech Stack:** TypeScript, grammy, googleapis, node-cron, pnpm, Node.js 20

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Modify: `.gitignore`

**Step 1: Initialize pnpm project**

Run: `pnpm init`

**Step 2: Install dependencies**

Run: `pnpm add grammy googleapis node-cron dotenv`

Run: `pnpm add -D typescript @types/node @types/node-cron tsx`

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Update package.json scripts**

Add to package.json:
```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc"
  }
}
```

**Step 5: Create .env.example**

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

**Step 6: Update .gitignore**

Append to .gitignore:
```
# Config with secrets
config.json
.env
```

**Step 7: Create src directory**

Run: `mkdir -p src`

**Step 8: Commit**

```
feat: initialize project with TypeScript and dependencies
```

---

## Task 2: Config Module

**Files:**
- Create: `src/config.ts`
- Create: `config.example.json`

**Step 1: Create config types and loader**

Create `src/config.ts`:

```typescript
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface UserConfig {
  name: string;
  googleRefreshToken: string;
  calendars: string[];
  notifyTime: string;
  timezone: string;
}

export interface Config {
  telegram: {
    botToken: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  users: Record<string, UserConfig>;
  allowedUserIds: string[];
}

const CONFIG_PATH = join(process.cwd(), "config.json");

export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      "config.json not found. Copy config.example.json and fill in your values."
    );
  }

  const raw = readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as Config;
}

export function isUserAllowed(userId: number): boolean {
  const config = loadConfig();
  return config.allowedUserIds.includes(String(userId));
}

export function getUserConfig(userId: number): UserConfig | undefined {
  const config = loadConfig();
  return config.users[String(userId)];
}
```

**Step 2: Create config.example.json**

```json
{
  "telegram": {
    "botToken": "123456:ABC-YourBotTokenHere"
  },
  "google": {
    "clientId": "your-client-id.apps.googleusercontent.com",
    "clientSecret": "GOCSPX-your-client-secret",
    "redirectUri": "http://localhost:3000/oauth/callback"
  },
  "users": {
    "123456789": {
      "name": "Your Name",
      "googleRefreshToken": "",
      "calendars": ["primary"],
      "notifyTime": "20:00",
      "timezone": "Asia/Singapore"
    }
  },
  "allowedUserIds": ["123456789"]
}
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm build`
Expected: No errors

**Step 4: Commit**

```
feat: add config module with types and loader
```

---

## Task 3: Google Calendar API Wrapper

**Files:**
- Create: `src/calendar.ts`

**Step 1: Create calendar module**

Create `src/calendar.ts`:

```typescript
import { google, calendar_v3 } from "googleapis";
import { loadConfig, getUserConfig } from "./config.js";

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date | null;
  endTime: Date | null;
  isAllDay: boolean;
  calendarName: string;
}

function getOAuth2Client() {
  const config = loadConfig();
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

export function getAuthUrl(userId: number): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
    state: String(userId),
    prompt: "consent",
  });
}

export async function exchangeCodeForTokens(
  code: string
): Promise<{ refreshToken: string }> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error("No refresh token received. Try revoking app access and re-authenticating.");
  }

  return { refreshToken: tokens.refresh_token };
}

async function getAuthenticatedClient(userId: number) {
  const userConfig = getUserConfig(userId);
  if (!userConfig?.googleRefreshToken) {
    throw new Error("User has not linked Google account");
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: userConfig.googleRefreshToken,
  });

  return oauth2Client;
}

export async function listCalendars(
  userId: number
): Promise<{ id: string; name: string }[]> {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: "v3", auth });

  const response = await calendar.calendarList.list();
  const items = response.data.items || [];

  return items.map((cal) => ({
    id: cal.id || "",
    name: cal.summary || "Unnamed Calendar",
  }));
}

export async function getEventsForDay(
  userId: number,
  date: Date
): Promise<CalendarEvent[]> {
  const userConfig = getUserConfig(userId);
  if (!userConfig) {
    throw new Error("User not found");
  }

  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: "v3", auth });

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const allEvents: CalendarEvent[] = [];

  for (const calendarId of userConfig.calendars) {
    try {
      const response = await calendar.events.list({
        calendarId,
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      const calendarInfo = await calendar.calendars.get({ calendarId });
      const calendarName = calendarInfo.data.summary || calendarId;

      const events = response.data.items || [];

      for (const event of events) {
        const isAllDay = !!event.start?.date;

        allEvents.push({
          id: event.id || "",
          title: event.summary || "Untitled",
          startTime: event.start?.dateTime
            ? new Date(event.start.dateTime)
            : event.start?.date
              ? new Date(event.start.date)
              : null,
          endTime: event.end?.dateTime
            ? new Date(event.end.dateTime)
            : event.end?.date
              ? new Date(event.end.date)
              : null,
          isAllDay,
          calendarName,
        });
      }
    } catch (error) {
      console.error(`Failed to fetch events from calendar ${calendarId}:`, error);
    }
  }

  // Sort: all-day events first, then by start time
  allEvents.sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    if (!a.startTime || !b.startTime) return 0;
    return a.startTime.getTime() - b.startTime.getTime();
  });

  return allEvents;
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm build`
Expected: No errors

**Step 3: Commit**

```
feat: add Google Calendar API wrapper
```

---

## Task 4: Event Formatting

**Files:**
- Create: `src/format.ts`

**Step 1: Create formatting module**

Create `src/format.ts`:

```typescript
import { CalendarEvent } from "./calendar.js";

function formatTime(date: Date, timezone: string): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
    hour12: false,
  });
}

function formatDate(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  });
}

export function formatEventsMessage(
  events: CalendarEvent[],
  date: Date,
  label: "Today" | "Tomorrow",
  timezone: string
): string {
  const dateStr = formatDate(date, timezone);
  let message = `📅 ${label} (${dateStr})\n\n`;

  if (events.length === 0) {
    message += "No events scheduled.";
    return message;
  }

  const allDayEvents = events.filter((e) => e.isAllDay);
  const timedEvents = events.filter((e) => !e.isAllDay);

  for (const event of allDayEvents) {
    message += `All day: ${event.title} [${event.calendarName}]\n`;
  }

  if (allDayEvents.length > 0 && timedEvents.length > 0) {
    message += "\n";
  }

  for (const event of timedEvents) {
    const start = event.startTime ? formatTime(event.startTime, timezone) : "??:??";
    const end = event.endTime ? formatTime(event.endTime, timezone) : "??:??";
    message += `${start} - ${end}  ${event.title} [${event.calendarName}]\n`;
  }

  message += `\n${events.length} event${events.length === 1 ? "" : "s"}`;

  return message;
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm build`
Expected: No errors

**Step 3: Commit**

```
feat: add event formatting module
```

---

## Task 5: Telegram Bot Commands

**Files:**
- Create: `src/bot.ts`

**Step 1: Create bot module with commands**

Create `src/bot.ts`:

```typescript
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
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm build`
Expected: No errors

**Step 3: Commit**

```
feat: add Telegram bot with /cal, /setup, /calendars commands
```

---

## Task 6: Scheduler for Daily Notifications

**Files:**
- Create: `src/scheduler.ts`

**Step 1: Create scheduler module**

Create `src/scheduler.ts`:

```typescript
import cron from "node-cron";
import { Bot } from "grammy";
import { loadConfig, getUserConfig } from "./config.js";
import { getEventsForDay } from "./calendar.js";
import { formatEventsMessage } from "./format.js";

export function startScheduler(bot: Bot): void {
  const config = loadConfig();

  // Schedule for each user based on their notifyTime
  for (const userId of config.allowedUserIds) {
    const userConfig = getUserConfig(Number(userId));
    if (!userConfig?.googleRefreshToken) {
      console.log(`Skipping scheduler for user ${userId}: no Google token`);
      continue;
    }

    const [hour, minute] = userConfig.notifyTime.split(":").map(Number);

    // node-cron uses local server time, so we'll use a simple approach
    // For production, consider using a timezone-aware scheduler
    const cronExpression = `${minute} ${hour} * * *`;

    console.log(
      `Scheduling daily notification for user ${userId} at ${userConfig.notifyTime}`
    );

    cron.schedule(cronExpression, async () => {
      console.log(`Running scheduled notification for user ${userId}`);

      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const events = await getEventsForDay(Number(userId), tomorrow);
        const message = formatEventsMessage(
          events,
          tomorrow,
          "Tomorrow",
          userConfig.timezone
        );

        await bot.api.sendMessage(Number(userId), message);
        console.log(`Sent notification to user ${userId}`);
      } catch (error) {
        console.error(`Failed to send notification to user ${userId}:`, error);
      }
    });
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm build`
Expected: No errors

**Step 3: Commit**

```
feat: add node-cron scheduler for daily notifications
```

---

## Task 7: Entry Point

**Files:**
- Create: `src/index.ts`

**Step 1: Create entry point**

Create `src/index.ts`:

```typescript
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
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm build`
Expected: No errors

**Step 3: Test the bot runs**

Run: `pnpm dev`
Expected: Should error about missing config.json (which is correct)

**Step 4: Commit**

```
feat: add entry point to start bot and scheduler
```

---

## Task 8: Final Verification

**Step 1: Verify full build**

Run: `pnpm build`
Expected: No errors, dist/ folder created with JS files

**Step 2: Create a test config.json**

Copy config.example.json to config.json and fill in:
- Your Telegram bot token (from @BotFather)
- Your Telegram user ID (from @userinfobot)

**Step 3: Test bot startup**

Run: `pnpm dev`
Expected: "Bot @yourbotname is running!"

**Step 4: Test /start command**

Send /start to your bot in Telegram
Expected: Welcome message with command list

**Step 5: Commit any final changes**

```
chore: finalize initial implementation
```

---

## Setup Instructions (for reference)

### 1. Create Telegram Bot
1. Message @BotFather on Telegram
2. Send `/newbot` and follow prompts
3. Copy the bot token to config.json

### 2. Create Google Cloud Project
1. Go to https://console.cloud.google.com
2. Create new project
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials (Desktop app type)
5. Copy client ID and secret to config.json

### 3. Get Your Telegram User ID
1. Message @userinfobot on Telegram
2. Copy your user ID to config.json `allowedUserIds`

### 4. Link Google Calendar
1. Run the bot with `pnpm dev`
2. Send `/setup` to get OAuth link
3. Complete OAuth flow
4. Copy refresh token to config.json (will need to extract from OAuth response)

---

## Future Improvements

- Add OAuth callback server to automatically capture refresh tokens
- Add inline buttons for /calendars to toggle calendars on/off
- Add timezone-aware cron scheduling
- Persist config changes (currently requires manual editing)

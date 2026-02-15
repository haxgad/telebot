# Telegram Calendar Bot Design

## Overview

A Telegram bot that:
1. Responds to `/cal` command to show calendar events for today or tomorrow
2. Sends a daily notification at 8 PM SGT with tomorrow's events

## Architecture

Long-running Node.js process with Telegram polling (no webhooks needed).

```
┌─────────────────────────────────────┐
│  Node.js Process                    │
│  ├── Telegram bot (polling)         │
│  ├── node-cron (8 PM scheduler)     │
│  └── Google Calendar API client     │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  config.json    │
│  (gitignored)   │
└─────────────────┘
```

## Tech Stack

| Purpose | Choice |
|---------|--------|
| Language | TypeScript |
| Telegram library | grammy |
| Google Calendar | googleapis |
| Scheduler | node-cron |
| Package manager | pnpm |
| Runtime | Node.js 20 |

## Project Structure

```
telebot/
├── src/
│   ├── index.ts         # Entry point, starts bot & scheduler
│   ├── bot.ts           # Telegram bot commands
│   ├── calendar.ts      # Google Calendar API wrapper
│   ├── scheduler.ts     # node-cron for daily notifications
│   ├── config.ts        # Load & type config
│   └── format.ts        # Event formatting
├── config.json          # User data (gitignored)
├── config.example.json  # Template for config
├── package.json
└── tsconfig.json
```

## Config Structure

```json
{
  "telegram": {
    "botToken": "123456:ABC..."
  },
  "google": {
    "clientId": "xxx.apps.googleusercontent.com",
    "clientSecret": "GOCSPX-..."
  },
  "users": {
    "123456789": {
      "name": "Harsh",
      "googleRefreshToken": "1//0abc...",
      "calendars": ["primary", "work@group.calendar.google.com"],
      "notifyTime": "20:00",
      "timezone": "Asia/Singapore"
    }
  },
  "allowedUserIds": ["123456789", "987654321"]
}
```

- `allowedUserIds` acts as the whitelist
- Each user has their own Google refresh token and selected calendars
- Supports multiple calendars per user (e.g., work and personal)

## Bot Commands

| Command | Action |
|---------|--------|
| `/start` | Welcome message, check if user is whitelisted |
| `/cal` | Show inline buttons: [Today] [Tomorrow] |
| `/setup` | Link Google account (OAuth flow) |
| `/calendars` | Pick which calendars to subscribe to |

## User Flows

### /cal Command Flow

```
User sends /cal
    → Bot replies with [Today] [Tomorrow] buttons
    → User taps "Tomorrow"
    → Bot fetches events from user's selected calendars
    → Bot sends formatted event list
```

### OAuth Flow (/setup)

```
User sends /setup
    → Bot replies with Google OAuth link
    → User authorizes in browser
    → Redirect to callback endpoint
    → Store refresh token in config
```

### Scheduled Notification (8 PM SGT)

```
node-cron triggers at 8 PM SGT
    → For each user in config
    → Fetch tomorrow's events from their calendars
    → Send Telegram message with event list
```

## Event Display Format

Chronological list with calendar labels:

```
📅 Tomorrow (Sat, Feb 15)

All day: Public holiday [Personal]

09:00 - 10:00  Team standup [Work]
14:00 - 15:30  Design review [Work]
18:30 - 19:30  Gym [Personal]
20:00 - 21:00  Dinner with Alex [Personal]

4 events
```

- All events in one chronological list
- Calendar name in brackets on each row
- All-day events shown at the top

## Users

- Whitelist of trusted Telegram user IDs
- Each user links their own Google account
- Each user selects which calendars they want to see
- Per-user timezone support (default: Asia/Singapore)

## Deployment

For development:
```bash
pnpm dev       # Development with hot reload
pnpm start     # Production
```

When ready to deploy, options include:
- Railway (free tier)
- Render (free tier)
- Fly.io (free tier)
- VPS (~$5/mo)

## Future Considerations

- Migrate config.json to a database (DynamoDB/S3) for production deployment
- Add more commands as needed

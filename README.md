# Telegram Calendar Bot

A personal Telegram bot that shows your Google Calendar events on demand and sends daily evening notifications with tomorrow's schedule.

## Features

- `/cal` - View today's or tomorrow's events with inline buttons
- `/calendars` - List available calendars and their IDs
- `/setup` - Link your Google Calendar account
- **Daily notifications** - Receive tomorrow's events at your configured time (default: 8 PM)
- **Multiple calendars** - Aggregate events from work, personal, and other calendars
- **Timezone-aware** - All times displayed in your configured timezone

## Setup

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token

### 2. Set Up Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable the **Google Calendar API**
4. Go to **APIs & Services** → **OAuth consent screen**
   - Choose "External"
   - Fill in app name and your email
   - Add yourself as a test user
5. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:3000/oauth/callback`
6. Copy the Client ID and Client Secret

### 3. Configure the Bot

```bash
# Install dependencies
pnpm install

# Copy example files
cp .env.example .env
cp config.example.json config.json
```

Edit `.env` with your credentials:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
GOOGLE_REFRESH_TOKEN_123456789=  # Add after OAuth
```

Edit `config.json` with your settings:

```json
{
  "users": {
    "YOUR_TELEGRAM_USER_ID": {
      "name": "Your Name",
      "calendars": ["primary"],
      "notifyTime": "20:00",
      "timezone": "Asia/Singapore"
    }
  },
  "allowedUserIds": ["YOUR_TELEGRAM_USER_ID"]
}
```

Get your Telegram user ID by messaging [@userinfobot](https://t.me/userinfobot).

### 4. Link Google Calendar

```bash
pnpm dev
```

1. Send `/setup` to your bot in Telegram
2. Click the authorization link
3. Authorize the app
4. Copy the refresh token from the redirect URL
5. Add it to `.env` as `GOOGLE_REFRESH_TOKEN_YOUR_USER_ID=token`
6. Restart the bot

### 5. Select Calendars

1. Send `/calendars` to see available calendars
2. Copy the calendar IDs you want
3. Update the `calendars` array in `config.json`
4. Restart the bot

## Usage

```bash
# Development (with hot reload)
pnpm dev

# Production
pnpm build
pnpm start
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and command list |
| `/cal` | Show today's or tomorrow's events |
| `/setup` | Get Google Calendar authorization link |
| `/calendars` | List available calendars |

## Project Structure

```
telebot/
├── src/
│   ├── index.ts      # Entry point
│   ├── bot.ts        # Telegram bot commands
│   ├── calendar.ts   # Google Calendar API
│   ├── scheduler.ts  # Daily notifications
│   ├── config.ts     # Configuration loader
│   └── format.ts     # Message formatting
├── config.json       # User settings (gitignored)
├── .env              # Secrets (gitignored)
└── ...
```

## License

MIT

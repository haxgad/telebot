# Telegram Calendar Bot

A simple personal Telegram bot that shows your Google Calendar events on demand, sends daily evening notifications with tomorrow's schedule, and supports reminders.

## Features

- `/today` - View today's events
- `/tomorrow` - View tomorrow's events
- `/week` - View next 7 days, grouped by day
- `/calendars` - List available calendars and their IDs
- `/setup` - Link your Google Calendar account
- **Daily notifications** - Receive tomorrow's events at your configured time (default: 8 PM). On Sundays, also includes a weekly summary
- **Custom reminders** - Set daily reminders at specific times with custom messages
- **Multiple calendars** - Aggregate events from work, personal, and other calendars
- **Timezone-aware** - All times displayed in your configured timezone

## Setup

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token
4. Get your Telegram user ID by messaging [@userinfobot](https://t.me/userinfobot)

### 2. Set Up Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable the **Google Calendar API**
4. Go to **APIs & Services** → **OAuth consent screen**
   - Choose "External"
   - Fill in app name and your email
   - Add your email as a test user
   - Click **PUBLISH APP** to avoid refresh token expiry (7 days if unpublished)
5. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:3000/oauth/callback`
6. Copy the **Client ID** and **Client Secret**

### 3. Configure the Bot

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/telebot.git
cd telebot

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
GOOGLE_REFRESH_TOKEN_123456789=  # Add after OAuth (step 4)
```

Edit `config.json` with your settings:

```json
{
  "users": {
    "YOUR_TELEGRAM_USER_ID": {
      "name": "Your Name",
      "calendars": ["primary"],
      "notifyTime": "20:00",
      "timezone": "Asia/Singapore",
      "reminders": [{ "time": "15:45", "message": "Your reminder message" }]
    }
  },
  "allowedUserIds": ["YOUR_TELEGRAM_USER_ID"]
}
```

### 4. Link Google Calendar

```bash
pnpm dev
```

1. Send `/setup` to your bot in Telegram
2. Click the authorization link and approve access
3. The redirect will fail (expected) - copy the `code` parameter from the URL:
   ```
   http://localhost:3000/oauth/callback?code=4/0ABC...&scope=...
   ```
4. Exchange the code for a refresh token:
   ```bash
   curl -X POST https://oauth2.googleapis.com/token \
     -d "code=YOUR_CODE" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "redirect_uri=http://localhost:3000/oauth/callback" \
     -d "grant_type=authorization_code"
   ```
5. Copy the `refresh_token` from the response
6. Add it to `.env` as `GOOGLE_REFRESH_TOKEN_YOUR_USER_ID=token`
7. Restart the bot

### 5. Select Calendars

1. Send `/calendars` to see available calendars
2. Copy the calendar IDs you want
3. Update the `calendars` array in `config.json`
4. Restart the bot

## Usage

```bash
# Development (with hot reload)
pnpm dev

# Production build
pnpm build
pnpm start
```

## Deployment (Fly.io)

The bot can be deployed to [Fly.io](https://fly.io) for free (runs 24/7).

### First-time setup

```bash
# Install Fly CLI
brew install flyctl

# Login
fly auth login

# Launch (creates app, doesn't deploy yet)
fly launch --no-deploy

# Set secrets
fly secrets set \
  TELEGRAM_BOT_TOKEN="xxx" \
  GOOGLE_CLIENT_ID="xxx" \
  GOOGLE_CLIENT_SECRET="xxx" \
  GOOGLE_REDIRECT_URI="http://localhost:3000/oauth/callback" \
  GOOGLE_REFRESH_TOKEN_123456789="xxx" \
  CONFIG_JSON='{"users":{"123456789":{"name":"Your Name","calendars":["primary"],"notifyTime":"20:00","timezone":"Asia/Singapore","reminders":[{"time":"15:45","message":"Your reminder"}]}},"allowedUserIds":["123456789"]}'

# Deploy
fly deploy
```

### Auto-deploy from GitHub

Push to `main` branch triggers automatic deployment via GitHub Actions.

Requires `FLY_API_TOKEN` secret in your GitHub repository (added automatically by `fly launch`).

## Bot Commands

| Command      | Description                            |
| ------------ | -------------------------------------- |
| `/start`     | Welcome message and command list       |
| `/today`     | Show today's events                    |
| `/tomorrow`  | Show tomorrow's events                 |
| `/week`      | Show next 7 days                       |
| `/setup`     | Get Google Calendar authorization link |
| `/calendars` | List available calendars               |

## Project Structure

```
telebot/
├── src/
│   ├── index.ts      # Entry point
│   ├── bot.ts        # Telegram bot commands
│   ├── calendar.ts   # Google Calendar API
│   ├── scheduler.ts  # Daily notifications (node-cron)
│   ├── config.ts     # Configuration loader
│   └── format.ts     # Message formatting
├── .env              # Secrets (gitignored)
├── config.json       # User settings (gitignored)
├── fly.toml          # Fly.io deployment config
├── Dockerfile        # Container build
└── .github/workflows # Auto-deploy action
```

## License

MIT

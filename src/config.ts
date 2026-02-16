import { readFileSync, existsSync } from "fs";
import { join } from "path";
import "dotenv/config";

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

interface FileConfig {
  users: Record<string, Omit<UserConfig, "googleRefreshToken">>;
  allowedUserIds: string[];
}

const CONFIG_PATH = join(process.cwd(), "config.json");

function loadFileConfig(): FileConfig {
  // Try CONFIG_JSON env var first (for production/Fly.io)
  if (process.env.CONFIG_JSON) {
    return JSON.parse(process.env.CONFIG_JSON) as FileConfig;
  }

  // Fall back to config.json file
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      "config.json not found. Set CONFIG_JSON env var or copy config.example.json."
    );
  }

  const raw = readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as FileConfig;
}

export function loadConfig(): Config {
  const fileConfig = loadFileConfig();

  // Build users with refresh tokens from environment
  const users: Record<string, UserConfig> = {};
  for (const [userId, userConfig] of Object.entries(fileConfig.users)) {
    users[userId] = {
      ...userConfig,
      googleRefreshToken: process.env[`GOOGLE_REFRESH_TOKEN_${userId}`] || "",
    };
  }

  return {
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth/callback",
    },
    users,
    allowedUserIds: fileConfig.allowedUserIds,
  };
}

export function isUserAllowed(userId: number): boolean {
  const config = loadConfig();
  return config.allowedUserIds.includes(String(userId));
}

export function getUserConfig(userId: number): UserConfig | undefined {
  const config = loadConfig();
  return config.users[String(userId)];
}

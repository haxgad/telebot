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

    // Validate notifyTime format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(userConfig.notifyTime)) {
      console.log(
        `Skipping scheduler for user ${userId}: invalid notifyTime format "${userConfig.notifyTime}" (expected HH:MM)`
      );
      continue;
    }

    const [hour, minute] = userConfig.notifyTime.split(":").map(Number);

    // Additional validation for valid time values
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      console.log(
        `Skipping scheduler for user ${userId}: invalid time values in "${userConfig.notifyTime}"`
      );
      continue;
    }

    const cronExpression = `${minute} ${hour} * * *`;

    console.log(
      `Scheduling daily notification for user ${userId} at ${userConfig.notifyTime} (${userConfig.timezone})`
    );

    cron.schedule(
      cronExpression,
      async () => {
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
      },
      { timezone: userConfig.timezone }
    );

    // Schedule custom reminders
    if (userConfig.reminders) {
      for (const reminder of userConfig.reminders) {
        if (!/^\d{2}:\d{2}$/.test(reminder.time)) {
          console.log(`Skipping invalid reminder time: ${reminder.time}`);
          continue;
        }

        const [rHour, rMinute] = reminder.time.split(":").map(Number);
        if (rHour < 0 || rHour > 23 || rMinute < 0 || rMinute > 59) {
          console.log(`Skipping invalid reminder time values: ${reminder.time}`);
          continue;
        }

        const reminderCron = `${rMinute} ${rHour} * * *`;

        console.log(
          `Scheduling reminder for user ${userId} at ${reminder.time}: "${reminder.message}"`
        );

        cron.schedule(
          reminderCron,
          async () => {
            try {
              await bot.api.sendMessage(Number(userId), reminder.message);
              console.log(`Sent reminder to user ${userId}: "${reminder.message}"`);
            } catch (error) {
              console.error(`Failed to send reminder to user ${userId}:`, error);
            }
          },
          { timezone: userConfig.timezone }
        );
      }
    }
  }
}

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

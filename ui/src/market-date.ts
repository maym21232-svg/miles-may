const easternClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", hourCycle: "h23",
});

export function expectedCloseDate(now = new Date()): string {
  const parts = easternClock.formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const day = new Date(Date.UTC(value("year"), value("month") - 1,
    value("day") - (value("hour") >= 16 ? 0 : 1)));
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

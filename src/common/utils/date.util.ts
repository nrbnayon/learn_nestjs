import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

export class DateUtil {
  static now(): Date {
    return new Date();
  }

  static toISO(date: Date | string): string {
    return dayjs(date).toISOString();
  }

  static fromNow(date: Date | string): string {
    return dayjs(date).fromNow();
  }

  static format(date: Date | string, format = 'YYYY-MM-DD HH:mm:ss'): string {
    return dayjs(date).format(format);
  }

  static addHours(date: Date | string, hours: number): Date {
    return dayjs(date).add(hours, 'hour').toDate();
  }

  static addDays(date: Date | string, days: number): Date {
    return dayjs(date).add(days, 'day').toDate();
  }

  static addMinutes(date: Date | string, minutes: number): Date {
    return dayjs(date).add(minutes, 'minute').toDate();
  }

  static isExpired(date: Date | string): boolean {
    return dayjs(date).isBefore(dayjs());
  }

  static isPast(date: Date | string): boolean {
    return dayjs(date).isBefore(dayjs());
  }

  static isFuture(date: Date | string): boolean {
    return dayjs(date).isAfter(dayjs());
  }

  static expiresInSeconds(date: Date | string): number {
    const diff = dayjs(date).diff(dayjs(), 'second');
    return Math.max(0, diff);
  }

  static toTimezone(date: Date | string, tz: string): string {
    return dayjs(date).tz(tz).format();
  }
}

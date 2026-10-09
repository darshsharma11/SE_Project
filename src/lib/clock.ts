/**
 * Centralized Clock service.
 * All "now" reads across the application MUST go through this module.
 * Supports a demo offset so time can be advanced during presentations/tests.
 */

class ClockService {
  private offsetMs = 0;

  /**
   * Returns the current effective date and time.
   */
  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  /**
   * Returns current time as ISO string.
   */
  nowISO(): string {
    return this.now().toISOString();
  }

  /**
   * Returns the current offset in milliseconds.
   */
  getOffsetMs(): number {
    return this.offsetMs;
  }

  /**
   * Sets the demo offset in milliseconds.
   */
  setOffsetMs(ms: number): void {
    this.offsetMs = ms;
  }

  /**
   * Sets the clock to a fixed target date.
   */
  setFixed(targetDate: Date): void {
    this.offsetMs = targetDate.getTime() - Date.now();
  }

  /**
   * Advance the clock by hours.
   */
  advanceHours(hours: number): void {
    this.offsetMs += hours * 3600 * 1000;
  }

  /**
   * Reset clock to actual system time.
   */
  reset(): void {
    this.offsetMs = 0;
  }
}

export const clock = new ClockService();

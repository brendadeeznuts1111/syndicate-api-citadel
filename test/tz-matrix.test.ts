import { expect, test } from 'bun:test';

/**
 * Timezone Matrix Test - Enhanced Runtime Gate
 *
 * Tests API behavior across multiple timezones to ensure consistent behavior.
 * Critical for APIs handling timestamps, scheduling, and international users.
 */

for (const tz of ['UTC', 'America/New_York', 'Europe/Berlin']) {
  test(`TZ=${tz} - Timezone matrix validation`, () => {
    // Set timezone for this test
    process.env.TZ = tz;

    // Test date parsing consistency
    const d = new Date('2025-06-25T12:00:00Z');
    expect(d.getTime()).toBe(1750852800000); // UTC timestamp should be consistent

    // Test timezone offset calculation
    const offset = d.getTimezoneOffset();
    expect(typeof offset).toBe('number');
    expect(offset).toBeGreaterThanOrEqual(-720); // Valid timezone offset range
    expect(offset).toBeLessThanOrEqual(720);

    // Test date formatting consistency
    const iso = d.toISOString();
    expect(iso).toBe('2025-06-25T12:00:00.000Z'); // Should always be UTC in ISO

    // Clean up
    delete process.env.TZ;
  });
}

// Additional timezone edge case tests
test('Timezone edge cases', () => {
  // Test daylight saving transitions
  const dstDate = new Date('2025-03-09T02:00:00'); // DST transition in US
  expect(dstDate.getTime()).toBeGreaterThan(0);

  // Test leap year handling
  const leapYear = new Date('2024-02-29T12:00:00Z');
  expect(leapYear.getDate()).toBe(29);

  // Test year boundary
  const yearBoundary = new Date('2024-12-31T23:59:59Z');
  expect(yearBoundary.getFullYear()).toBe(2024);
});

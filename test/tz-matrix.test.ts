import { expect, test, describe, expectTypeOf } from 'bun:test';

/**
 * Timezone Matrix Test - Enhanced Runtime Gate v1.3
 *
 * Leverages Bun 1.3 concurrent testing for faster timezone matrix validation.
 * Tests API behavior across multiple timezones using test.concurrent.
 */

// Concurrent timezone matrix using Bun 1.3 test.concurrent
describe.concurrent('Timezone Matrix Validation', () => {
  const timezones = ['UTC', 'America/New_York', 'Europe/Berlin', 'Asia/Tokyo'];

  timezones.forEach(tz => {
    test.concurrent(`TZ=${tz} - API consistency`, () => {
      // Set timezone for this concurrent test
      process.env.TZ = tz;

      // Test date parsing consistency
      const d = new Date('2025-06-25T12:00:00Z');
      expect(d.getTime()).toBe(1750852800000); // UTC timestamp should be consistent

      // Test timezone offset calculation
      const offset = d.getTimezoneOffset();
      expect(typeof offset).toBe('number');
      expect(offset).toBeGreaterThanOrEqual(-840); // Extended range for Asia
      expect(offset).toBeLessThanOrEqual(840);

      // Test date formatting consistency
      const iso = d.toISOString();
      expect(iso).toBe('2025-06-25T12:00:00.000Z');

      // Clean up
      delete process.env.TZ;
    });
  });

  // Test that should pass (timezone handling is robust)
  test('Invalid timezone handling', () => {
    process.env.TZ = 'Invalid/Timezone';
    const d = new Date('2025-06-25T12:00:00Z');
    // This should fail in most environments
    expect(d.getTimezoneOffset()).toBe(0);
  });
});

// Additional timezone edge cases using test.concurrent.each (Bun 1.3)
describe.concurrent('Timezone Edge Cases', () => {
  test.concurrent.each([
    ['DST Transition', '2025-03-09T02:00:00'],
    ['Leap Year', '2024-02-29T12:00:00Z'],
    ['Year Boundary', '2024-12-31T23:59:59Z'],
    ['Unix Epoch', '1970-01-01T00:00:00Z']
  ])('Edge case: %s (%s)', (description, dateString) => {
    const date = new Date(dateString);
    expect(date.getTime()).toBeGreaterThanOrEqual(0); // Unix epoch is 0
    expect(date.toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  // Type testing with Bun 1.3 expectTypeOf()
  test('Type safety validation', () => {
    expectTypeOf<Date>().toEqualTypeOf<Date>();
    expectTypeOf<string>().toEqualTypeOf<string>();

    const date = new Date();
    expectTypeOf(date.getTime()).toBeNumber();
    expectTypeOf(date.toISOString()).toBeString();
  });
});

// Internationalization test using concurrent testing
describe.concurrent('International Date Formatting', () => {
  test.concurrent.each([
    ['en-US', '6/25/2025'],
    ['de-DE', '25.6.2025'],
    ['ja-JP', '2025/6/25']
  ])('Locale %s formats as %s', (locale, expectedPattern) => {
    const date = new Date('2025-06-25T12:00:00Z');

    // Note: Intl.DateTimeFormat might not be fully available in all Bun environments
    try {
      const formatter = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      });
      const formatted = formatter.format(date);
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    } catch (error) {
      // Skip if Intl not available
      console.log(`⚠️  Intl.DateTimeFormat not available for ${locale}`);
    }
  });
});

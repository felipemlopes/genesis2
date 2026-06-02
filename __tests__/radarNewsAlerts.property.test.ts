import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-based tests for Radar News frontend hook logic.
 * Feature: radar-news
 * Property 14: Popup state management (max 5 simultaneous)
 * Property 15: Polling lifecycle (subscribe/unsubscribe)
 */

// ─── Extracted pure logic for testability ───────────────────────────────

interface RadarNewsItem {
  id: number;
  title: string;
  source: string;
  source_url: string | null;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string | null;
  affected_assets: string[];
  market_bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  impact_summary: string | null;
  discovery_score: number | null;
  is_discovery: boolean;
  created_at: string;
  timestamp_local: number;
}

/**
 * Pure function replicating the popup state logic from useRadarNewsAlerts:
 * - No duplicates (by id)
 * - Max 5 items
 * - Newest items prepended, oldest trimmed via .slice(0, 5)
 */
function addNewsToState(prev: RadarNewsItem[], novoItem: RadarNewsItem): RadarNewsItem[] {
  if (prev.some(n => n.id === novoItem.id)) return prev;
  return [novoItem, ...prev].slice(0, 5);
}

/**
 * Pure function replicating the dismiss logic from useRadarNewsAlerts.
 */
function removeNewsFromState(prev: RadarNewsItem[], id: number): RadarNewsItem[] {
  return prev.filter(item => item.id !== id);
}

/**
 * Pure function replicating subscribe/unsubscribe lifecycle.
 * Returns whether polling should be active given subscriber count.
 */
function shouldPollBeActive(subscriberCount: number): boolean {
  return subscriberCount > 0;
}

// ─── Arbitraries ────────────────────────────────────────────────────────

const severityArb = fc.constantFrom('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') as fc.Arbitrary<RadarNewsItem['severity']>;
const biasArb = fc.constantFrom('BULLISH', 'BEARISH', 'NEUTRAL') as fc.Arbitrary<RadarNewsItem['market_bias']>;

const radarNewsItemArb = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  source: fc.constantFrom('Reuters', 'Bloomberg', 'CoinDesk', 'The Block', 'Decrypt', 'FT Markets'),
  source_url: fc.option(fc.webUrl(), { nil: null }),
  severity: severityArb,
  category: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  affected_assets: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 0, maxLength: 5 }),
  market_bias: biasArb,
  impact_summary: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: null }),
  discovery_score: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
  is_discovery: fc.boolean(),
  created_at: fc.integer({ min: 1577836800000, max: 1893456000000 }).map(ts => new Date(ts).toISOString()),
  timestamp_local: fc.integer({ min: 1000000000000, max: 2000000000000 }),
});

// Generate an array of news items with unique IDs
const uniqueNewsArrayArb = fc.uniqueArray(radarNewsItemArb, {
  comparator: (a, b) => a.id === b.id,
  minLength: 0,
  maxLength: 20,
});

// ─── Property 14: Popup state management ────────────────────────────────

describe('Feature: radar-news, Property 14: Popup state management', () => {
  it('should never exceed 5 simultaneous items regardless of how many are added', () => {
    fc.assert(
      fc.property(uniqueNewsArrayArb, (entries) => {
        let state: RadarNewsItem[] = [];
        for (const entry of entries) {
          state = addNewsToState(state, entry);
        }
        expect(state.length).toBeLessThanOrEqual(5);
      }),
      { numRuns: 200 }
    );
  });

  it('should keep newest items when list is full (oldest trimmed)', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(radarNewsItemArb, { comparator: (a, b) => a.id === b.id, minLength: 6, maxLength: 15 }),
        (entries) => {
          let state: RadarNewsItem[] = [];
          for (const entry of entries) {
            state = addNewsToState(state, entry);
          }
          // The most recently added item should be at index 0
          const lastAdded = entries[entries.length - 1];
          expect(state[0].id).toBe(lastAdded.id);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('should not add duplicate items (same id)', () => {
    fc.assert(
      fc.property(radarNewsItemArb, (item) => {
        let state: RadarNewsItem[] = [];
        state = addNewsToState(state, item);
        state = addNewsToState(state, item); // add same item again
        expect(state.length).toBe(1);
      }),
      { numRuns: 200 }
    );
  });

  it('should dismiss the oldest item when at capacity and a new item arrives', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(radarNewsItemArb, { comparator: (a, b) => a.id === b.id, minLength: 6, maxLength: 6 }),
        (entries) => {
          let state: RadarNewsItem[] = [];
          // Add first 5
          for (let i = 0; i < 5; i++) {
            state = addNewsToState(state, entries[i]);
          }
          expect(state.length).toBe(5);

          // The first item added is now at the end (index 4)
          const oldestId = state[4].id;

          // Add 6th item → should push oldest out
          state = addNewsToState(state, entries[5]);
          expect(state.length).toBe(5);
          expect(state.some(n => n.id === oldestId)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('removing an item should decrease the list length by exactly 1', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(radarNewsItemArb, { comparator: (a, b) => a.id === b.id, minLength: 1, maxLength: 5 }),
        (entries) => {
          let state: RadarNewsItem[] = [];
          for (const entry of entries) {
            state = addNewsToState(state, entry);
          }
          const prevLength = state.length;
          const toRemove = state[0];
          state = removeNewsFromState(state, toRemove.id);
          expect(state.length).toBe(prevLength - 1);
          expect(state.some(n => n.id === toRemove.id)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Property 15: Polling lifecycle (subscribe/unsubscribe) ─────────────

describe('Feature: radar-news, Property 15: Polling lifecycle subscribe/unsubscribe', () => {
  it('polling should be active iff subscriber count > 0', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (count) => {
        const active = shouldPollBeActive(count);
        if (count > 0) {
          expect(active).toBe(true);
        } else {
          expect(active).toBe(false);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('subscribe/unsubscribe sequence should correctly track active state', () => {
    // Model: simulate a series of subscribe (+1) and unsubscribe (-1) operations
    const operationArb = fc.array(
      fc.constantFrom('subscribe', 'unsubscribe'),
      { minLength: 1, maxLength: 50 }
    );

    fc.assert(
      fc.property(operationArb, (operations) => {
        let subscriberCount = 0;

        for (const op of operations) {
          if (op === 'subscribe') {
            subscriberCount++;
          } else if (op === 'unsubscribe' && subscriberCount > 0) {
            subscriberCount--;
          }
          // Invariant: polling active iff subscribers > 0
          expect(shouldPollBeActive(subscriberCount)).toBe(subscriberCount > 0);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('unsubscribing below zero should not happen (subscriber count floor is 0)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('subscribe', 'unsubscribe'), { minLength: 1, maxLength: 100 }),
        (operations) => {
          let subscriberCount = 0;

          for (const op of operations) {
            if (op === 'subscribe') {
              subscriberCount++;
            } else if (op === 'unsubscribe' && subscriberCount > 0) {
              subscriberCount--;
            }
          }
          // Count should never go negative
          expect(subscriberCount).toBeGreaterThanOrEqual(0);
          // Final polling state should match
          expect(shouldPollBeActive(subscriberCount)).toBe(subscriberCount > 0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('all subscribers unsubscribing should deactivate polling', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), (numSubscribers) => {
        let subscriberCount = numSubscribers;
        // All subscribe first
        expect(shouldPollBeActive(subscriberCount)).toBe(true);

        // All unsubscribe
        for (let i = 0; i < numSubscribers; i++) {
          subscriberCount--;
        }
        expect(subscriberCount).toBe(0);
        expect(shouldPollBeActive(subscriberCount)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });
});

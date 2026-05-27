import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-based tests for GeoEngineContext
 * Feature: genesis-moderate-fixes
 * Properties: P1, P2, P3, P13
 */

// --- Mock localStorage ---
let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { store = {}; },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// --- Minimal GeoEngine mock that mirrors the real singleton behavior ---
interface MockGeoEvent {
  id: string;
  title: string;
  marketWeight: number;
}

class MockGeopoliticalEngine {
  private events: MockGeoEvent[] = [];
  private listeners: Set<(events: MockGeoEvent[], delta: MockGeoEvent | null) => void> = new Set();
  private interval: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.isActive()) return;
    // Simulate interval without actual async work
    this.interval = setInterval(() => {}, 180000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  isActive(): boolean {
    return this.interval !== null;
  }

  subscribe(listener: (events: MockGeoEvent[], delta: MockGeoEvent | null) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  getEvents(): MockGeoEvent[] {
    return [...this.events];
  }

  // Test helper: push events as if pipeline processed them
  _pushEvent(event: MockGeoEvent) {
    this.events = [event, ...this.events].slice(0, 100);
    this.listeners.forEach(l => l([...this.events], event));
  }

  _reset() {
    this.stop();
    this.events = [];
    this.listeners.clear();
  }
}

const STORAGE_KEY = 'genesis_geo_radar_active';

// Simulates the Provider logic (extracted from GeoEngineContext.tsx) for unit-level property testing
// without needing React rendering
function createProviderLogic(engine: MockGeopoliticalEngine) {
  let isScanning = engine.isActive();
  let events = engine.getEvents();

  // Restore from localStorage on "mount"
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'true' && !engine.isActive()) {
    engine.start();
    isScanning = true;
  }

  const unsubscribe = engine.subscribe((newEvents) => {
    events = newEvents;
  });

  const start = () => {
    engine.start();
    isScanning = true;
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const stop = () => {
    engine.stop();
    isScanning = false;
    localStorage.setItem(STORAGE_KEY, 'false');
  };

  const toggle = () => {
    if (engine.isActive()) stop();
    else start();
  };

  const destroy = () => { unsubscribe(); };

  return {
    getIsScanning: () => isScanning,
    getEvents: () => events,
    start,
    stop,
    toggle,
    destroy,
  };
}

describe('GeoEngineContext Property Tests', () => {
  let engine: MockGeopoliticalEngine;

  beforeEach(() => {
    store = {};
    engine = new MockGeopoliticalEngine();
  });

  afterEach(() => {
    engine._reset();
  });

  // Feature: genesis-moderate-fixes, Property 1: Round-trip do estado do Radar
  describe('P1: Round-trip do estado do Radar', () => {
    it('persisting state to localStorage and restoring on new mount produces the same value', () => {
      fc.assert(
        fc.property(fc.boolean(), (activeState) => {
          // Reset
          store = {};
          engine._reset();

          // Simulate setting state
          if (activeState) {
            localStorage.setItem(STORAGE_KEY, 'true');
          } else {
            localStorage.setItem(STORAGE_KEY, 'false');
          }

          // Simulate new mount (new provider instance reads localStorage)
          const provider = createProviderLogic(engine);
          const restoredState = provider.getIsScanning();

          // Cleanup
          provider.destroy();
          engine._reset();

          // The restored state must match what was persisted
          return restoredState === activeState;
        }),
        { numRuns: 100 }
      );
    });

    it('toggle persists and round-trips correctly for any sequence of toggles', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constant('toggle'), { minLength: 1, maxLength: 20 }),
          (toggles) => {
            store = {};
            engine._reset();

            const provider = createProviderLogic(engine);

            // Apply toggles
            for (const _ of toggles) {
              provider.toggle();
            }

            const finalState = provider.getIsScanning();
            provider.destroy();

            // Create new provider — should restore the final state
            engine._reset();
            // Engine was stopped by _reset, localStorage still has the value
            const provider2 = createProviderLogic(engine);
            const restoredState = provider2.getIsScanning();
            provider2.destroy();
            engine._reset();

            return restoredState === finalState;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: genesis-moderate-fixes, Property 2: Engine sobrevive a unmount
  describe('P2: Engine sobrevive a unmount', () => {
    it('unmounting all consumers does not stop an active engine', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (numConsumers) => {
            engine._reset();
            store = {};

            // Start engine
            engine.start();
            expect(engine.isActive()).toBe(true);

            // Simulate N consumers subscribing and then unsubscribing (unmounting)
            const unsubscribers: (() => void)[] = [];
            for (let i = 0; i < numConsumers; i++) {
              const unsub = engine.subscribe(() => {});
              unsubscribers.push(unsub);
            }

            // Unmount all consumers
            for (const unsub of unsubscribers) {
              unsub();
            }

            // Engine must still be active
            const stillActive = engine.isActive();
            engine._reset();

            return stillActive === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: genesis-moderate-fixes, Property 3: Eventos acumulados entregues ao subscriber
  describe('P3: Eventos acumulados entregues ao subscriber', () => {
    it('events pushed while no subscriber are delivered when a new subscriber connects', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 1, maxLength: 50 }),
              marketWeight: fc.integer({ min: 1, max: 100 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (eventList) => {
            engine._reset();
            engine.start();

            // Push events with NO subscribers
            for (const evt of eventList) {
              engine._pushEvent(evt);
            }

            // Now subscribe — getEvents should return all accumulated events
            const accumulated = engine.getEvents();

            // All pushed events should be present (up to 100 cap)
            const expectedCount = Math.min(eventList.length, 100);
            const allPresent = accumulated.length === expectedCount;

            // Events are in reverse order (newest first)
            const correctOrder = accumulated.every((evt, idx) => {
              const expectedEvt = eventList[eventList.length - 1 - idx];
              return evt.id === expectedEvt.id;
            });

            engine._reset();
            return allPresent && correctOrder;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('subscriber receives accumulated events immediately via getEvents after reconnect', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 1, maxLength: 30 }),
              marketWeight: fc.integer({ min: 1, max: 100 }),
            }),
            { minLength: 1, maxLength: 15 }
          ),
          (eventList) => {
            engine._reset();
            engine.start();

            // First subscriber connects and disconnects
            const unsub1 = engine.subscribe(() => {});
            unsub1();

            // Events arrive while no subscriber is connected
            for (const evt of eventList) {
              engine._pushEvent(evt);
            }

            // New subscriber connects — should see all events via getEvents
            let receivedEvents: MockGeoEvent[] = [];
            const unsub2 = engine.subscribe((evts) => {
              receivedEvents = evts;
            });

            // getEvents returns accumulated
            const fromGetEvents = engine.getEvents();
            unsub2();
            engine._reset();

            return fromGetEvents.length === Math.min(eventList.length, 100);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: genesis-moderate-fixes, Property 13: Engine inativo quando radar desativado
  describe('P13: Engine inativo quando radar desativado', () => {
    it('when radar is deactivated, engine reports isActive() === false', () => {
      fc.assert(
        fc.property(
          fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
          (actions) => {
            engine._reset();
            store = {};

            const provider = createProviderLogic(engine);

            // Apply a sequence of start/stop actions
            for (const shouldStart of actions) {
              if (shouldStart) provider.start();
              else provider.stop();
            }

            const lastAction = actions[actions.length - 1];
            const engineActive = engine.isActive();
            const providerScanning = provider.getIsScanning();

            provider.destroy();
            engine._reset();

            // If last action was stop (false), engine must be inactive
            if (!lastAction) {
              return engineActive === false && providerScanning === false;
            }
            // If last action was start (true), engine must be active
            return engineActive === true && providerScanning === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('stopped engine does not have an active interval (no polling)', () => {
      fc.assert(
        fc.property(fc.constant(null), () => {
          engine._reset();
          store = {};

          const provider = createProviderLogic(engine);
          provider.start();
          expect(engine.isActive()).toBe(true);

          provider.stop();

          const inactive = !engine.isActive();
          provider.destroy();
          engine._reset();

          return inactive;
        }),
        { numRuns: 100 }
      );
    });
  });
});

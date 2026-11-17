import { BEACON_EVENTS, BEACON_RESULTS, type BeaconEventName, type BeaconResult } from './beacon-events';

export interface BeaconFields { level?: string; result?: BeaconResult }

export interface BeaconOptions {
  game: string;
  // The build variable VITE_BEACON_URL. With no value nothing is ever sent.
  url?: string | undefined;
  // The usage data switch of the settings. Asked at each send. While it answers false nothing is sent.
  enabled?: () => boolean;
  navigator?: { sendBeacon?: (url: string, data: Blob) => boolean };
}

export interface Beacon { send(event: BeaconEventName, fields?: BeaconFields): void }

function envUrl(): string | undefined {
  return import.meta.env?.VITE_BEACON_URL;
}

// Sends the body as text/plain, so the browser makes no preflight request.
export function createBeacon(options: BeaconOptions): Beacon {
  const url = 'url' in options ? options.url : envUrl();
  return {
    send(event, fields = {}) {
      if (!url) return;
      if (options.enabled && !options.enabled()) return;
      const spec = BEACON_EVENTS.find((e) => e.event === event);
      if (!spec) return;
      const body: Record<string, string> = { game: options.game, event };
      if (spec.fields.includes('level')) {
        if (typeof fields.level !== 'string') return;
        body.level = fields.level;
      }
      if (spec.fields.includes('result')) {
        if (fields.result === undefined || !BEACON_RESULTS.includes(fields.result)) return;
        body.result = fields.result;
      }
      const nav = options.navigator ?? (typeof navigator === 'undefined' ? undefined : navigator);
      try {
        nav?.sendBeacon?.(url, new Blob([JSON.stringify(body)], { type: 'text/plain' }));
      } catch {
        // A beacon never breaks the game.
      }
    },
  };
}

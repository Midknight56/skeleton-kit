// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BEACON_EVENTS } from './beacon-events';
import { createBeacon } from './beacon';

interface Sent { url: string; blob: Blob }

function fakeNavigator() {
  const sent: Sent[] = [];
  return {
    sent,
    nav: {
      sendBeacon(url: string, data: Blob) {
        sent.push({ url, blob: data });
        return true;
      },
    },
  };
}

const readBlob = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

describe('beacon with no url', () => {
  it('sends nothing when the url is not given', () => {
    const { sent, nav } = fakeNavigator();
    const beacon = createBeacon({ game: 'game-a', navigator: nav });
    beacon.send('open');
    beacon.send('level_start', { level: 'lv-1' });
    expect(sent).toEqual([]);
  });

  it('sends nothing when the url is empty', () => {
    const { sent, nav } = fakeNavigator();
    const beacon = createBeacon({ game: 'game-a', url: '', navigator: nav });
    beacon.send('open');
    expect(sent).toEqual([]);
  });

  it('does not throw when there is no sendBeacon at all', () => {
    const beacon = createBeacon({ game: 'game-a', url: 'https://example.invalid/b', navigator: {} });
    expect(() => beacon.send('open')).not.toThrow();
  });
});

describe('beacon with a url', () => {
  const url = 'https://example.invalid/b';

  async function body(event: Parameters<ReturnType<typeof createBeacon>['send']>[0], fields?: Parameters<ReturnType<typeof createBeacon>['send']>[1]) {
    const { sent, nav } = fakeNavigator();
    createBeacon({ game: 'game-a', url, navigator: nav }).send(event, fields);
    expect(sent.length).toBe(1);
    expect(sent[0]!.url).toBe(url);
    expect(sent[0]!.blob.type).toBe('text/plain');
    return readBlob(sent[0]!.blob);
  }

  it('sends open with only game and event', async () => {
    expect(await body('open')).toBe('{"game":"game-a","event":"open"}');
  });

  it('sends level_start with the level', async () => {
    expect(await body('level_start', { level: 'lv-3' })).toBe('{"game":"game-a","event":"level_start","level":"lv-3"}');
  });

  it('sends watch_start with the level', async () => {
    expect(await body('watch_start', { level: 'lv-3' })).toBe('{"game":"game-a","event":"watch_start","level":"lv-3"}');
  });

  it('sends watch_end with the level and nothing else', async () => {
    expect(await body('watch_end', { level: 'lv-3' })).toBe('{"game":"game-a","event":"watch_end","level":"lv-3"}');
    expect(await body('watch_end', { level: 'lv-3', result: 'won' })).toBe('{"game":"game-a","event":"watch_end","level":"lv-3"}');
  });

  it('sends nothing for a watch_end without a level', () => {
    const { sent, nav } = fakeNavigator();
    createBeacon({ game: 'game-a', url, navigator: nav }).send('watch_end');
    expect(sent).toEqual([]);
  });

  it('sends level_end with the result left', async () => {
    expect(await body('level_end', { level: 'lv-3', result: 'left' })).toBe('{"game":"game-a","event":"level_end","level":"lv-3","result":"left"}');
  });

  it('sends nothing for a level_end with a result that is not won, lost or left', () => {
    const { sent, nav } = fakeNavigator();
    createBeacon({ game: 'game-a', url, navigator: nav }).send('level_end', { level: 'lv-3', result: 'quit' } as never);
    expect(sent).toEqual([]);
  });

  it('sends level_end with the level and the result', async () => {
    expect(await body('level_end', { level: 'lv-3', result: 'won' })).toBe('{"game":"game-a","event":"level_end","level":"lv-3","result":"won"}');
    expect(await body('level_end', { level: 'lv-3', result: 'lost' })).toBe('{"game":"game-a","event":"level_end","level":"lv-3","result":"lost"}');
  });

  it('drops a level from open and a result from every event but level_end', async () => {
    expect(await body('open', { level: 'lv-1', result: 'won' })).toBe('{"game":"game-a","event":"open"}');
    expect(await body('level_start', { level: 'lv-1', result: 'won' })).toBe('{"game":"game-a","event":"level_start","level":"lv-1"}');
    expect(await body('watch_start', { level: 'lv-1', result: 'lost' })).toBe('{"game":"game-a","event":"watch_start","level":"lv-1"}');
  });

  it('never sends a field that is not in the list, whatever is passed', async () => {
    const { sent, nav } = fakeNavigator();
    const beacon = createBeacon({ game: 'game-a', url, navigator: nav });
    beacon.send('level_end', { level: 'lv-1', result: 'won', user: 'u-1', time: 5 } as never);
    const parsed = JSON.parse(await readBlob(sent[0]!.blob)) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(['event', 'game', 'level', 'result']);
  });

  it('sends nothing for a level_start without a level', () => {
    const { sent, nav } = fakeNavigator();
    createBeacon({ game: 'game-a', url, navigator: nav }).send('level_start');
    expect(sent).toEqual([]);
  });
});

describe('beacon with the usage switch off', () => {
  const url = 'https://example.invalid/b';

  it('sends nothing at all while the switch is off, and sends again when it is on', () => {
    const { sent, nav } = fakeNavigator();
    let on = false;
    const beacon = createBeacon({ game: 'game-a', url, navigator: nav, enabled: () => on });
    beacon.send('open');
    beacon.send('level_start', { level: 'lv-1' });
    beacon.send('watch_end', { level: 'lv-1' });
    beacon.send('level_end', { level: 'lv-1', result: 'left' });
    expect(sent).toEqual([]);
    on = true;
    beacon.send('open');
    expect(sent.length).toBe(1);
  });
});

describe('beacon events list', () => {
  it('lists five events and the fields of each, as plain data', () => {
    expect(BEACON_EVENTS.map((e) => e.event)).toEqual(['open', 'level_start', 'watch_start', 'watch_end', 'level_end']);
    expect(BEACON_EVENTS.map((e) => e.fields)).toEqual([['game'], ['game', 'level'], ['game', 'level'], ['game', 'level'], ['game', 'level', 'result']]);
  });

  it('tells the privacy page about watch_end and the three results', () => {
    const says = (name: string) => BEACON_EVENTS.find((e) => e.event === name)?.says ?? '';
    expect(says('watch_end')).not.toBe('');
    expect(says('level_end')).toContain('won, lost or left');
    expect(JSON.parse(JSON.stringify(BEACON_EVENTS))).toEqual(BEACON_EVENTS);
  });
});

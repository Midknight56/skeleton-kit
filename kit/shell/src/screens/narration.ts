// A text version of the play state for a screen reader. It is hidden from the eye by a clip, not by
// display or hidden, so the accessibility tree holds it. A change of its text is read out politely.
export interface Narration {
  el: HTMLElement;
  say(text: string | null): void;
}

export function narrationRegion(doc: Document): Narration {
  const el = doc.createElement('div');
  el.dataset.narration = '';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;font-size:16px;pointer-events:none';
  return {
    el,
    say(text) {
      if (text === null) return;
      el.textContent = text;
    },
  };
}

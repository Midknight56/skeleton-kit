import { mountGame } from '@kit/shell';
import type { ProofFile, ProofIndex, ProofSet } from '@kit/shell';
import { runnerTheme } from '../theme';
import def from './def';
import { runnerInput } from './input';
import { createRunnerEffects } from './view/effects';
import { runnerTexts } from './results';

// The proof files sit next to the page in the built site: /proofs/runner/ from /runner/.
async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.json()) as T;
}

const proofs: ProofSet = {
  loadIndex: () => fetchJson<ProofIndex>('../proofs/runner/index.json'),
  load: (levelId) => fetchJson<ProofFile>(`../proofs/runner/${encodeURIComponent(levelId)}.json`),
};

const element = document.getElementById('app');
if (!element) throw new Error('The page has no element with the id app.');

mountGame(element, {
  def,
  theme: runnerTheme,
  input: runnerInput,
  proofs,
  texts: runnerTexts,
  search: window.location.search,
  effects: createRunnerEffects,
  tagline: 'Tap to jump. Reach the gate.',
  credits: [
    def.title,
    'Made by Adrian Ferguson, Midknight Entertainment',
    'A one button runner made with the kit of this repository.',
    'The pictures are plain shapes drawn for it.',
    'Every sound is made in code.',
    'Type: Bricolage Grotesque, SIL Open Font License 1.1.',
    'Type: Sometype Mono, SIL Open Font License 1.1.',
  ],
});

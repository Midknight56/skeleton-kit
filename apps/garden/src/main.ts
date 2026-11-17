import { mountGame } from '@kit/shell';
import type { ProofFile, ProofIndex, ProofSet } from '@kit/shell';
import { gardenTheme } from '../theme';
import def from './def';
import { gardenInput } from './input';
import { gardenTexts } from './results';

// The proof files sit next to the page in the built site: /proofs/garden/ from /garden/.
async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.json()) as T;
}

const proofs: ProofSet = {
  loadIndex: () => fetchJson<ProofIndex>('../proofs/garden/index.json'),
  load: (levelId) => fetchJson<ProofFile>(`../proofs/garden/${encodeURIComponent(levelId)}.json`),
};

const element = document.getElementById('app');
if (!element) throw new Error('The page has no element with the id app.');

mountGame(element, {
  def,
  theme: gardenTheme,
  input: gardenInput,
  proofs,
  texts: gardenTexts,
  search: window.location.search,
  credits: [def.title, 'Made by Adrian Ferguson, Midknight Entertainment', 'A puzzle made with the kit of this repository.', 'The pictures are plain shapes drawn for it.', 'Every sound is made in code.'],
});

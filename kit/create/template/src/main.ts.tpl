import { mountGame } from '@kit/shell';
import type { ProofFile, ProofIndex, ProofSet } from '@kit/shell';
import { gameTheme } from '../theme';
import def from './def';
import { gameInput } from './input';
import { gameTexts } from './results';

// The proof files sit next to the page in the built site: /proofs/__ID__/ from /__ID__/.
async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return (await response.json()) as T;
}

const proofs: ProofSet = {
  loadIndex: () => fetchJson<ProofIndex>('../proofs/__ID__/index.json'),
  load: (levelId) => fetchJson<ProofFile>(`../proofs/__ID__/${encodeURIComponent(levelId)}.json`),
};

document.title = def.title;

const element = document.getElementById('app');
if (!element) throw new Error('The page has no element with the id app.');

mountGame(element, {
  def,
  theme: gameTheme,
  input: gameInput,
  proofs,
  texts: gameTexts,
  search: window.location.search,
  credits: [def.title, 'Made with the kit of this repository.', 'Every sound is made in code.'],
});

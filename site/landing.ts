// The landing page script. It reads the proof file of the garden puzzle level g03 from the built site and
// lists the tool calls that play that level. It imports nothing from the kit or from a game.

interface ProofFile {
  level: string;
  seed: number;
  replay: { actions: string[] };
}

// A run length item is text such as "wait*2". The proof files hold actions in this form.
function expand(items: string[]): string[] {
  return items.flatMap((item) => {
    const match = /^(.*)\*(\d+)$/.exec(item);
    return match ? Array.from({ length: Number(match[2]) }, () => match[1] as string) : [item];
  });
}

function call(name: string, input: unknown): HTMLLIElement {
  const li = document.createElement('li');
  const title = document.createElement('code');
  title.className = 'name';
  title.textContent = name;
  const body = document.createElement('code');
  body.textContent = ` ${JSON.stringify(input)}`;
  li.append(title, body);
  return li;
}

async function main(): Promise<void> {
  const list = document.querySelector('[data-calls]');
  if (!list) return;
  try {
    const response = await fetch('./proofs/garden/g03.json');
    if (!response.ok) throw new Error(String(response.status));
    const proof = (await response.json()) as ProofFile;
    list.replaceChildren(
      call('new_game', { level: proof.level, seed: proof.seed }),
      call('act', { session: 's1', actions: expand(proof.replay.actions) }),
      call('replay', { session: 's1' }),
    );
  } catch {
    const li = document.createElement('li');
    li.textContent = 'The calls could not be loaded.';
    list.replaceChildren(li);
  }
}

void main();

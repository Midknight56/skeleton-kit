export type RawCourse = { id: string; title: string; air2: string; air1: string; ground: string };

export type RunnerState = {
  level: string;
  air2: string; // the course rows, never changed
  air1: string;
  ground: string;
  tick: number;
  x: number; // left edge of the player's box
  feetY: number; // 0 on the ground, negative in the air
  vy: number; // negative is upward
  onGround: boolean;
  candles: number[]; // column indexes of candles not yet taken, air1 as c, air2 as c + 1000, ascending
  score: number;
  phase: 'playing' | 'won' | 'lost';
  reason: '' | 'hit' | 'fell';
};

/** The start state of a course that has no problems. */
export function initState(course: RawCourse): RunnerState {
  const candles: number[] = [];
  for (let i = 0; i < course.air1.length; i++) if (course.air1.charAt(i) === 'c') candles.push(i);
  for (let i = 0; i < course.air2.length; i++) if (course.air2.charAt(i) === 'c') candles.push(i + 1000);
  return {
    level: course.id,
    air2: course.air2,
    air1: course.air1,
    ground: course.ground,
    tick: 0,
    x: 0,
    feetY: 0,
    vy: 0,
    onGround: true,
    candles,
    score: 0,
    phase: 'playing',
    reason: '',
  };
}

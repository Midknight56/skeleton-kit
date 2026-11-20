export { mountGame } from './mount';
export type { MountOptions } from './mount';
export { checkTheme } from './theme';
export { clamp01, createEffectRandom, createParticles, drawGlow, easeInOut, easeOut } from './effects';
export type { EffectCtx, EffectFactory, EffectLayer, ParticleSeed, Particles, Pose, Slot } from './effects';
export { TOKENS } from './tokens';
export { WATCH_MESSAGE, watchMessage } from './watch-message';
export type { WatchMessage } from './watch-message';
export type { SoundName, SoundRecipe, Theme } from './theme';
export { checkControls } from './layout';
export type { ChipLimits, ControlBox, Rect } from './layout';
export { hudTextBoxes, itemIdsAt, sceneBoxes } from './painter';
export { playLayout } from './layout';
export { showHints } from './lessons';
export type { Hints, HintArea } from './lessons';
export { buttonWidth } from './screens/play-screen';
export type {
  GameTexts,
  InputButton,
  InputEvent,
  InputMap,
  Lesson,
  ProofFile,
  ProofIndex,
  ProofSet,
} from './types';
export { describeFacts } from './difficulty';
export type { Difficulty, LevelFacts } from './difficulty';

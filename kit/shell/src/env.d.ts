// The one build variable the shell reads.
interface ImportMetaEnv {
  readonly VITE_BEACON_URL?: string;
}

interface ImportMeta {
  readonly env?: ImportMetaEnv;
}

import { registerPlugin } from "@capacitor/core";

import type { BuildAlphaVoicePlugin } from "./definitions";

const BuildAlphaVoice = registerPlugin<BuildAlphaVoicePlugin>(
  "BuildAlphaVoice",
  {
    web: () => import("./web").then((m) => new m.BuildAlphaVoiceWeb()),
  },
);

export * from "./definitions";
export { BuildAlphaVoice };

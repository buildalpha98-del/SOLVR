// Rollup config for @buildalpha/capacitor-voice.
//
// Builds dist/plugin.cjs.js (CommonJS for old bundlers) from the dist/esm/
// output produced by tsc. The ESM output is the primary entry point;
// CJS is for older Capacitor bridges and React Native compat.
export default {
  input: "dist/esm/index.js",
  output: [
    {
      file: "dist/plugin.cjs.js",
      format: "cjs",
      sourcemap: true,
      inlineDynamicImports: true,
    },
  ],
  external: ["@capacitor/core"],
};

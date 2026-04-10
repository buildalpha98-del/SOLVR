export const colors = {
  background: "#0A1628",
  surface: "#0F1F3D",
  border: "rgba(255,255,255,0.07)",
  primary: "#F5A623",
  textPrimary: "#FAFAF8",
  textSecondary: "rgba(255,255,255,0.55)",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  tabInactive: "rgba(255,255,255,0.4)",
} as const;

export const fonts = {
  titleBold: "Syne_700Bold",
  titleSemiBold: "Syne_600SemiBold",
  bodyRegular: "DMSans_400Regular",
  bodySemiBold: "DMSans_600SemiBold",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/**
 * Local bundled logo asset. Pass the require() result to <Image source={LOGO} />
 * (not {{ uri: LOGO }}). The PNG lives at assets/logo.png and is bundled into the app,
 * so it works offline and loads instantly.
 */
export const LOGO = require("../assets/logo.png");

/** @deprecated Use LOGO with a require-based source. Kept only for backward compatibility. */
export const LOGO_URL = "";

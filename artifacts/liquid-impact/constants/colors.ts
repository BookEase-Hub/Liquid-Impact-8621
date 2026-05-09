const darkPalette = {
  text: "#FFFFFF",
  tint: "#00B4D8",
  background: "#0A0A0F",
  backgroundSecondary: "#151520",
  backgroundTertiary: "#1E1E2E",
  card: "#151520",
  surface: "#2A2A3C",
  foreground: "#FFFFFF",
  subtext: "#C0C0D0",
  mutedForeground: "#6B6B80",
  border: "rgba(255, 255, 255, 0.08)",
  glassBorder: "rgba(255, 255, 255, 0.12)",
  input: "rgba(255, 255, 255, 0.1)",
  primary: "#00B4D8",
  primaryDim: "rgba(0, 180, 216, 0.15)",
  primaryGlow: "rgba(0, 180, 216, 0.3)",
  secondary: "#7B2CBF",
  secondaryDim: "rgba(123, 44, 191, 0.15)",
  accent: "#FF6B9D",
  accentDim: "rgba(255, 107, 157, 0.15)",
  scoreHigh: "#00C853",
  scoreHighDim: "rgba(0, 200, 83, 0.15)",
  scoreMedium: "#FF9800",
  scoreMediumDim: "rgba(255, 152, 0, 0.15)",
  scoreLow: "#FF3D00",
  scoreLowDim: "rgba(255, 61, 0, 0.15)",
  success: "#00C853",
  successDim: "rgba(0, 200, 83, 0.15)",
  warning: "#FF9800",
  warningDim: "rgba(255, 152, 0, 0.15)",
  danger: "#FF3D00",
  dangerDim: "rgba(255, 61, 0, 0.15)",
};

const colors = {
  light: darkPalette,
  dark: darkPalette,
  radius: 20,
} as const;

export default colors;
export type ColorPalette = typeof darkPalette;

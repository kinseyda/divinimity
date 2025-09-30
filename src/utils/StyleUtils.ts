// Retrieve the daisyui theme colors
export function getDaisyUIColor(varName: string): string {
  // Use the daisyui CSS variable name like `--color-primary`

  if (typeof document === "undefined") {
    // Server-side rendering, fail gracefully and return a default value
    return "#000000"; // Default to black or any other fallback color
  }
  // Try to get from body, fallback to :root
  const style = getComputedStyle(document.body);
  return (
    style.getPropertyValue(varName) ||
    getComputedStyle(document.documentElement).getPropertyValue(varName)
  );
}

export interface DaisyUIColors {
  primary: string;
  secondary: string;
  accent: string;
  warning: string;
  success: string;
  error: string;
  info: string;
  base200: string;
  base300: string;
  baseContent: string;
  neutral: string;
}

export function getDaisyUIColors(): DaisyUIColors {
  return {
    primary: getDaisyUIColor("--color-primary"),
    secondary: getDaisyUIColor("--color-secondary"),
    accent: getDaisyUIColor("--color-accent"),
    warning: getDaisyUIColor("--color-warning"),
    success: getDaisyUIColor("--color-success"),
    error: getDaisyUIColor("--color-error"),
    info: getDaisyUIColor("--color-info"),
    base200: getDaisyUIColor("--color-base-200"),
    base300: getDaisyUIColor("--color-base-300"),
    baseContent: getDaisyUIColor("--color-base-content"),
    neutral: getDaisyUIColor("--color-neutral"),
  };
}

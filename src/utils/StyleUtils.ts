// Retrieve the daisyui theme colors
export function getDaisyUIColor(varName: string): string {
  // Use the daisyui CSS variable name like `--color-primary`

  // Try to get from body, fallback to :root
  const style = getComputedStyle(document.body);
  return (
    style.getPropertyValue(varName) ||
    getComputedStyle(document.documentElement).getPropertyValue(varName)
  );
}

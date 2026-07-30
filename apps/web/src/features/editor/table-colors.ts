// Swatch palette is shared by canvas, sidebar, and inspector so color choices do not drift between editor surfaces.
export const tableColorOptions = ['#58cc02', '#1cb0f6', '#ffc800', '#ff6b6b', '#8b5cf6', '#009991'] as const;

export const defaultTableColor = '#009991';

const legacyTableColorAliases = new Map<string, string>([
  ['#ff4b4b', '#ff6b6b'],
  ['#0f766e', defaultTableColor],
]);

export function getDisplayTableColor(color?: string | null): string {
  const normalizedColor = color?.toLowerCase();

  if (!normalizedColor) {
    return defaultTableColor;
  }

  // Existing development data may contain older high-saturation colors, so display is normalized without mutating saved diagrams.
  return legacyTableColorAliases.get(normalizedColor) ?? normalizedColor;
}

export function getTableColorLabel(color: string): string {
  const labels: Record<string, string> = {
    '#009991': 'teal',
    '#1cb0f6': 'sky blue',
    '#58cc02': 'green',
    '#8b5cf6': 'purple',
    '#ff6b6b': 'coral',
    '#ffc800': 'gold',
  };

  // Import lama atau input custom bisa membawa warna di luar palette resmi, jadi fallback hex tetap paling jujur.
  return labels[color.toLowerCase()] ?? color;
}

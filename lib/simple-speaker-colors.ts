/**
 * Simple Speaker Colors with inline styles
 * Funciona garantizado porque usa estilos CSS directos
 */

// Colores fijos usando CSS values
const SPEAKER_COLORS = [
  { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', accent: '#3b82f6' }, // blue
  { bg: '#dcfce7', text: '#166534', border: '#86efac', accent: '#22c55e' }, // green  
  { bg: '#f3e8ff', text: '#7c2d12', border: '#c4b5fd', accent: '#8b5cf6' }, // purple
  { bg: '#fed7aa', text: '#9a3412', border: '#fdba74', accent: '#f97316' }, // orange
  { bg: '#fce7f3', text: '#be185d', border: '#f9a8d4', accent: '#ec4899' }, // pink
  { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc', accent: '#6366f1' }, // indigo
  { bg: '#ccfdf7', text: '#134e4a', border: '#5eead4', accent: '#14b8a6' }, // teal
  { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', accent: '#ef4444' }, // red
  { bg: '#fefce8', text: '#a16207', border: '#fde047', accent: '#eab308' }, // yellow
  { bg: '#cffafe', text: '#155e75', border: '#67e8f9', accent: '#06b6d4' }, // cyan
];

export interface SimpleSpeakerColors {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  accentColor: string;
}

/**
 * Reset color assignments (útil para testing)
 */
export function resetSpeakerColors(): void {
  colorCache.clear();
  speakerOrder.length = 0;
}

/**
 * Cache de colores para consistencia y orden secuencial
 */
const colorCache = new Map<string, SimpleSpeakerColors>();
const speakerOrder: string[] = [];

/**
 * Obtiene colores para un speaker usando asignación secuencial
 */
export function getSimpleSpeakerColors(speaker: string): SimpleSpeakerColors {
  if (colorCache.has(speaker)) {
    return colorCache.get(speaker)!;
  }

  // Asignar siguiente color disponible secuencialmente
  let index = speakerOrder.indexOf(speaker);
  if (index === -1) {
    speakerOrder.push(speaker);
    index = speakerOrder.length - 1;
  }
  
  // Usar módulo para ciclar colores si hay más speakers que colores
  const colorIndex = index % SPEAKER_COLORS.length;
  const colors = SPEAKER_COLORS[colorIndex];
  
  const result: SimpleSpeakerColors = {
    backgroundColor: colors.bg,
    textColor: colors.text,
    borderColor: colors.border,
    accentColor: colors.accent,
  };

  colorCache.set(speaker, result);
  return result;
}

/**
 * React hook para usar con estilos inline
 */
export function useSimpleSpeakerColors(speaker: string): SimpleSpeakerColors {
  return getSimpleSpeakerColors(speaker);
}
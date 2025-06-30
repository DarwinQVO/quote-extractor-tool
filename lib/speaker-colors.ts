/**
 * Dynamic Speaker Color System
 * Generates consistent, accessible colors for transcript speakers
 */

// Enterprise color palette usando solo clases core de Tailwind
const SPEAKER_COLOR_PALETTE = [
  // Usando colores más básicos que seguro están en Tailwind
  { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', accent: 'bg-blue-500', ring: 'ring-blue-300' },
  { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', accent: 'bg-green-500', ring: 'ring-green-300' },
  { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', accent: 'bg-purple-500', ring: 'ring-purple-300' },
  { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', accent: 'bg-orange-500', ring: 'ring-orange-300' },
  { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300', accent: 'bg-pink-500', ring: 'ring-pink-300' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300', accent: 'bg-indigo-500', ring: 'ring-indigo-300' },
  { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300', accent: 'bg-teal-500', ring: 'ring-teal-300' },
  { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', accent: 'bg-red-500', ring: 'ring-red-300' },
  { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', accent: 'bg-yellow-500', ring: 'ring-yellow-300' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300', accent: 'bg-cyan-500', ring: 'ring-cyan-300' },
] as const;

// Dark mode color variants simplificado
const SPEAKER_COLOR_PALETTE_DARK = [
  { bg: 'dark:bg-blue-900', text: 'dark:text-blue-200', border: 'dark:border-blue-700', accent: 'dark:bg-blue-600', ring: 'dark:ring-blue-700' },
  { bg: 'dark:bg-green-900', text: 'dark:text-green-200', border: 'dark:border-green-700', accent: 'dark:bg-green-600', ring: 'dark:ring-green-700' },
  { bg: 'dark:bg-purple-900', text: 'dark:text-purple-200', border: 'dark:border-purple-700', accent: 'dark:bg-purple-600', ring: 'dark:ring-purple-700' },
  { bg: 'dark:bg-orange-900', text: 'dark:text-orange-200', border: 'dark:border-orange-700', accent: 'dark:bg-orange-600', ring: 'dark:ring-orange-700' },
  { bg: 'dark:bg-pink-900', text: 'dark:text-pink-200', border: 'dark:border-pink-700', accent: 'dark:bg-pink-600', ring: 'dark:ring-pink-700' },
  { bg: 'dark:bg-indigo-900', text: 'dark:text-indigo-200', border: 'dark:border-indigo-700', accent: 'dark:bg-indigo-600', ring: 'dark:ring-indigo-700' },
  { bg: 'dark:bg-teal-900', text: 'dark:text-teal-200', border: 'dark:border-teal-700', accent: 'dark:bg-teal-600', ring: 'dark:ring-teal-700' },
  { bg: 'dark:bg-red-900', text: 'dark:text-red-200', border: 'dark:border-red-700', accent: 'dark:bg-red-600', ring: 'dark:ring-red-700' },
  { bg: 'dark:bg-yellow-900', text: 'dark:text-yellow-200', border: 'dark:border-yellow-700', accent: 'dark:bg-yellow-600', ring: 'dark:ring-yellow-700' },
  { bg: 'dark:bg-cyan-900', text: 'dark:text-cyan-200', border: 'dark:border-cyan-700', accent: 'dark:bg-cyan-600', ring: 'dark:ring-cyan-700' },
] as const;

export interface SpeakerColors {
  background: string;
  text: string;
  border: string;
  accent: string;
  ring: string;
}

/**
 * Speaker color assignment cache
 * Ensures consistent colors across sessions and components
 */
class SpeakerColorManager {
  private colorCache = new Map<string, SpeakerColors>();
  private speakerIndex = new Map<string, number>();
  private nextColorIndex = 0;

  /**
   * Generates a consistent hash-based index for a speaker name
   */
  private generateSpeakerHash(speaker: string): number {
    let hash = 0;
    for (let i = 0; i < speaker.length; i++) {
      const char = speaker.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % SPEAKER_COLOR_PALETTE.length;
  }

  /**
   * Gets or assigns colors for a speaker
   * Uses consistent hashing to ensure same speaker gets same color
   */
  getSpeakerColors(speaker: string): SpeakerColors {
    if (this.colorCache.has(speaker)) {
      return this.colorCache.get(speaker)!;
    }

    // Try hash-based assignment first for consistency
    let colorIndex = this.generateSpeakerHash(speaker);
    
    // If color is already taken by another speaker, use sequential assignment
    const usedIndices = Array.from(this.speakerIndex.values());
    if (usedIndices.includes(colorIndex)) {
      colorIndex = this.nextColorIndex % SPEAKER_COLOR_PALETTE.length;
      this.nextColorIndex++;
    }

    this.speakerIndex.set(speaker, colorIndex);
    
    const lightColors = SPEAKER_COLOR_PALETTE[colorIndex];
    const darkColors = SPEAKER_COLOR_PALETTE_DARK[colorIndex];
    
    const colors: SpeakerColors = {
      background: `${lightColors.bg} ${darkColors.bg}`,
      text: `${lightColors.text} ${darkColors.text}`,
      border: `${lightColors.border} ${darkColors.border}`,
      accent: `${lightColors.accent} ${darkColors.accent}`,
      ring: `${lightColors.ring} ${darkColors.ring}`,
    };

    this.colorCache.set(speaker, colors);
    return colors;
  }

  /**
   * Gets all speakers with their assigned colors
   */
  getAllSpeakerColors(): Map<string, SpeakerColors> {
    return new Map(this.colorCache);
  }

  /**
   * Resets color assignments (useful for testing or fresh starts)
   */
  resetColors(): void {
    this.colorCache.clear();
    this.speakerIndex.clear();
    this.nextColorIndex = 0;
  }

  /**
   * Pre-assigns colors for a list of speakers
   * Useful for transcript loading to ensure consistent colors
   */
  assignColorsForSpeakers(speakers: string[]): void {
    speakers.forEach(speaker => {
      if (!this.colorCache.has(speaker)) {
        this.getSpeakerColors(speaker);
      }
    });
  }

  /**
   * Updates speaker name while preserving color assignment
   */
  updateSpeakerName(oldName: string, newName: string): void {
    if (this.colorCache.has(oldName)) {
      const colors = this.colorCache.get(oldName)!;
      const index = this.speakerIndex.get(oldName)!;
      
      this.colorCache.delete(oldName);
      this.speakerIndex.delete(oldName);
      
      this.colorCache.set(newName, colors);
      this.speakerIndex.set(newName, index);
    }
  }
}

// Global singleton instance
export const speakerColorManager = new SpeakerColorManager();

/**
 * React hook for getting speaker colors
 */
export function useSpeakerColors(speaker: string): SpeakerColors {
  return speakerColorManager.getSpeakerColors(speaker);
}

/**
 * Utility function for getting speaker colors (non-React)
 */
export function getSpeakerColors(speaker: string): SpeakerColors {
  return speakerColorManager.getSpeakerColors(speaker);
}

/**
 * Initialize colors for a transcript's speakers
 */
export function initializeSpeakerColors(speakers: string[]): void {
  speakerColorManager.assignColorsForSpeakers(speakers);
}

/**
 * Get CSS-in-JS compatible color values for dynamic styling
 */
export function getSpeakerColorValues(speaker: string): {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  accentColor: string;
} {
  const index = speakerColorManager.generateSpeakerHash(speaker) % SPEAKER_COLOR_PALETTE.length;
  const palette = SPEAKER_COLOR_PALETTE[index];
  
  // Convert Tailwind classes to CSS values for dynamic usage
  const colorMap: Record<string, string> = {
    'blue': '#dbeafe',
    'green': '#dcfce7',
    'purple': '#f3e8ff',
    'orange': '#fed7aa',
    'pink': '#fce7f3',
    'indigo': '#e0e7ff',
    'teal': '#ccfdf7',
    'red': '#fee2e2',
    'yellow': '#fefce8',
    'cyan': '#cffafe',
    'emerald': '#d1fae5',
    'violet': '#ede9fe',
    'amber': '#fef3c7',
    'lime': '#ecfccb',
    'sky': '#e0f2fe',
  };

  const colorName = palette.bg.match(/bg-(\w+)-/)?.[1] || 'blue';
  
  return {
    backgroundColor: colorMap[colorName] || colorMap.blue,
    textColor: `var(--${colorName}-700)`,
    borderColor: `var(--${colorName}-300)`,
    accentColor: `var(--${colorName}-600)`,
  };
}
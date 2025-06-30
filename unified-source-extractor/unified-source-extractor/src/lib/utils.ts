import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format duration from seconds to human-readable
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// Format timestamp to YouTube-style link
export function formatTimestampLink(url: string, seconds: number): string {
  if (!url || !seconds) return url;
  
  const urlObj = new URL(url);
  if (urlObj.hostname.includes("youtube.com") || urlObj.hostname.includes("youtu.be")) {
    urlObj.searchParams.set("t", seconds.toString());
  }
  return urlObj.toString();
}

// Format date relative to now
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 7) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } else if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  } else {
    return "Just now";
  }
}

// Extract domain from URL
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return "Unknown";
  }
}

// Generate citation based on source type
export function generateCitation(source: any, quote?: any): string {
  switch (source.type) {
    case "youtube":
      return `${source.title}${quote?.speaker ? `, ${quote.speaker}` : ""} (${source.metadata?.channel || "YouTube"}, ${new Date(source.published_at || source.created_at).getFullYear()})`;
    
    case "web":
      return `"${quote?.text || "Quote"}" ${source.title} (${source.metadata?.provider || extractDomain(source.url)}, ${new Date(source.published_at || source.created_at).toLocaleDateString()})`;
    
    case "document":
      return `${source.author || "Unknown Author"}, "${source.title}"${quote?.page_reference ? `, p. ${quote.page_reference}` : ""} (${new Date(source.published_at || source.created_at).getFullYear()})`;
    
    default:
      return `${source.title} (${new Date(source.published_at || source.created_at).getFullYear()})`;
  }
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// Generate color from string (for consistent avatar colors)
export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Debounce function for search/filter
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Parse YouTube URL and extract video ID
export function parseYouTubeUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  
  return null;
}

// Check if URL is supported source type
export function detectSourceType(url: string): "youtube" | "web" | "document" | null {
  try {
    const urlObj = new URL(url);
    
    // YouTube detection
    if (urlObj.hostname.includes("youtube.com") || urlObj.hostname.includes("youtu.be")) {
      return "youtube";
    }
    
    // Document detection by extension
    const documentExtensions = [".pdf", ".doc", ".docx", ".txt", ".md"];
    if (documentExtensions.some(ext => urlObj.pathname.toLowerCase().endsWith(ext))) {
      return "document";
    }
    
    // Default to web for other URLs
    return "web";
  } catch {
    return null;
  }
}

// Sort sources by various criteria
export function sortSources<T extends { created_at: Date | string; title: string }>(
  sources: T[],
  sortBy: "date" | "title" | "type" = "date",
  order: "asc" | "desc" = "desc"
): T[] {
  return [...sources].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case "date":
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
      case "title":
        comparison = a.title.localeCompare(b.title);
        break;
    }
    
    return order === "desc" ? -comparison : comparison;
  });
}
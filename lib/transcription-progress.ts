// Store progress for SSE
const progressStore = new Map<string, number>();

export function setProgress(sourceId: string, progress: number): void {
  progressStore.set(sourceId, progress);
}

export function getProgress(sourceId: string): number {
  return progressStore.get(sourceId) || 0;
}

export function deleteProgress(sourceId: string): void {
  progressStore.delete(sourceId);
}
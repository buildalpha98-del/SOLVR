/**
 * Offline Mutation Queue
 *
 * Stores failed mutations in localStorage when offline,
 * then replays them when connectivity returns.
 *
 * Each queued item stores the tRPC procedure path and input,
 * so we can replay via the tRPC client.
 */

const STORAGE_KEY = "solvr-offline-queue";

export interface QueuedMutation {
  id: string;
  /** tRPC procedure path, e.g. "portal.updateJob" */
  procedure: string;
  /** Serialised input for the mutation */
  input: unknown;
  /** ISO timestamp when queued */
  queuedAt: string;
  /** Number of replay attempts */
  attempts: number;
}

/** Read the current queue from localStorage */
export function getQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save the queue to localStorage */
function saveQueue(queue: QueuedMutation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/** Add a mutation to the offline queue */
export function enqueue(procedure: string, input: unknown): void {
  const queue = getQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    procedure,
    input,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  });
  saveQueue(queue);
}

/** Remove a specific item from the queue */
export function dequeue(id: string): void {
  const queue = getQueue().filter((item) => item.id !== id);
  saveQueue(queue);
}

/** Clear the entire queue */
export function clearQueue(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently fail
  }
}

/** Get the count of queued mutations */
export function getQueueCount(): number {
  return getQueue().length;
}

/** Increment the attempt count for a queued item */
export function incrementAttempts(id: string): void {
  const queue = getQueue();
  const item = queue.find((q) => q.id === id);
  if (item) {
    item.attempts += 1;
    saveQueue(queue);
  }
}

/** Remove items that have exceeded max attempts */
export function pruneStale(maxAttempts = 5): QueuedMutation[] {
  const queue = getQueue();
  const stale = queue.filter((q) => q.attempts >= maxAttempts);
  const fresh = queue.filter((q) => q.attempts < maxAttempts);
  saveQueue(fresh);
  return stale;
}

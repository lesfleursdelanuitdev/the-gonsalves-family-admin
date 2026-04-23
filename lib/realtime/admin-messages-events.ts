import { EventEmitter } from "node:events";

/**
 * In-process pub/sub for admin message changes. Enables SSE push without WebSockets.
 * Note: With multiple Node replicas, use Redis pub/sub (or similar); each process has its own emitter.
 */
const emitter = new EventEmitter();
emitter.setMaxListeners(200);

export function emitAdminMessagesChanged(): void {
  emitter.emit("changed");
}

export function subscribeAdminMessagesChanged(handler: () => void): () => void {
  emitter.on("changed", handler);
  return () => emitter.off("changed", handler);
}

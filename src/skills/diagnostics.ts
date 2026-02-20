/**
 * Diagnostics utilities for debugging WebSocket message formats
 */

// Store last captured messages in memory
interface CapturedMessage {
  direction: 'client->container' | 'container->client';
  timestamp: string;
  raw: string;
  parsed?: any;
}

const capturedMessages: CapturedMessage[] = [];
const MAX_CAPTURED = 50;

let captureEnabled = false;

export function enableCapture() {
  captureEnabled = true;
  capturedMessages.length = 0; // Clear old captures
  console.log('[Diagnostics] Capture enabled');
}

export function disableCapture() {
  captureEnabled = false;
  console.log('[Diagnostics] Capture disabled');
}

export function isCaptureEnabled(): boolean {
  return captureEnabled;
}

export function captureMessage(direction: 'client->container' | 'container->client', data: string) {
  if (!captureEnabled) return;

  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch (e) {
    parsed = null;
  }

  capturedMessages.push({
    direction,
    timestamp: new Date().toISOString(),
    raw: data.slice(0, 500), // Truncate to avoid memory issues
    parsed
  });

  // Keep only last MAX_CAPTURED messages
  if (capturedMessages.length > MAX_CAPTURED) {
    capturedMessages.shift();
  }

  console.log(`[Diagnostics] Captured ${direction} message`);
}

export function getCapturedMessages(): CapturedMessage[] {
  return [...capturedMessages];
}

export function clearCaptures() {
  capturedMessages.length = 0;
}

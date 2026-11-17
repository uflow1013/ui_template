import "server-only";

const attemptWindow = 10 * 60 * 1000;
const limits = { perClient: 6, total: 50 };
let validUntil = 0;
let total = 0;
const failures = new Map<string, number>();

// The process-wide cap also bounds the map and closes the gap when a client
// can influence the forwarding header.
export function checkAttempt(client: string, verify: () => boolean, now = Date.now()) {
  if (now >= validUntil) {
    validUntil = now + attemptWindow;
    total = 0;
    failures.clear();
  }

  const count = failures.get(client) ?? 0;
  if (total >= limits.total || count >= limits.perClient) return "limited";
  if (verify()) {
    failures.delete(client);
    return "accepted";
  }

  failures.set(client, count + 1);
  total += 1;
  return "rejected";
}

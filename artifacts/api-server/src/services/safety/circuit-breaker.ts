// artifacts/api-server/src/services/safety/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(private config: { failureThreshold: number; resetTimeout: number }) {}

  allowRequest(): boolean {
    if (this.state === 'CLOSED') return true;

    if (this.state === 'OPEN') {
      const now = Date.now();
      if (this.lastFailureTime && now - this.lastFailureTime > this.config.resetTimeout) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }

    return true; // HALF_OPEN
  }

  recordSuccess(): void {
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }
}

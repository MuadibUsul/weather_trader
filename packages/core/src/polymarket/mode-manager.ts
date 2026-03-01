import type { ExecutionEngine, ExecutionMode } from "./types";

export class ModeManager {
  private mode: ExecutionMode;
  private readonly engines: Record<ExecutionMode, ExecutionEngine>;

  constructor(engines: Record<ExecutionMode, ExecutionEngine>, initialMode: ExecutionMode = "PAPER") {
    this.engines = engines;
    this.mode = initialMode;
  }

  getMode(): ExecutionMode {
    return this.mode;
  }

  switchMode(next: ExecutionMode): void {
    this.mode = next;
  }

  getEngine(mode?: ExecutionMode): ExecutionEngine {
    return this.engines[mode ?? this.mode];
  }
}

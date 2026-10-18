// Parse worker entry. All logic lives in pipeline.ts (createWorkerHandler) so it is unit-testable.
// Only progress counters, ImportSummary and an aggregate StatsBundle are ever posted from here.
import type { FromWorker, ToWorker } from "./protocol";
import { createWorkerHandler } from "./pipeline";

interface WorkerScope {
  postMessage(message: FromWorker): void;
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
}
const scope = self as unknown as WorkerScope;

const handle = createWorkerHandler((message) => scope.postMessage(message));
scope.onmessage = (event) => {
  void handle(event.data);
};

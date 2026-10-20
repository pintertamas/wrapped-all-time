// React binding for the import client: one client per mounted import page.
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { registerWorkerTerminator } from "../storage/clear";
import { createImportClient, type ImportClient, type ImportState } from "./client";

export function useImport(injected?: ImportClient): { state: ImportState; client: ImportClient } {
  const client = useMemo(() => injected ?? createImportClient(), [injected]);
  useEffect(() => {
    // Only dispose clients we created; an injected one belongs to the caller.
    const unregister = registerWorkerTerminator(() => client.dispose());
    return () => {
      unregister();
      if (!injected) client.dispose();
    };
  }, [client, injected]);
  const state = useSyncExternalStore(client.subscribe, client.getState, client.getState);
  return { state, client };
}

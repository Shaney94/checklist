"use client";
import { useEffect, useRef, useState } from "react";
import { request, message, APIError } from "./api";
import type { Workspace } from "./types";
export function useWorkspace() {
  const [state, setState] = useState<Workspace>({
      revision: 0,
      data: { properties: [] },
    }),
    [selected, setSelected] = useState(""),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [conflict, setConflict] = useState(false);
  const current = useRef(state),
    locked = useRef(false);
  function accept(next: Workspace) {
    current.current = next;
    setState(next);
    setSelected((id) =>
      next.data.properties.some((p) => p.id === id)
        ? id
        : next.data.properties[0]?.id || "",
    );
  }
  async function load() {
    setReady(false);
    setStatus("Loading your cleaning tools…");
    try {
      accept(await request<Workspace>("/api/dashboard"));
      setReady(true);
      setStatus("");
      setConflict(false);
    } catch (e) {
      setStatus(message(e));
      setConflict(true);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(body: Record<string, unknown>) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    const optimistic = structuredClone(current.current);
    if (body.action === "applicability") {
      const p = optimistic.data.properties.find(p => p.id === body.id);
      if (p && (body.kind === "regular" || body.kind === "deep") && typeof body.index === "number") {
        p.notApplicable ||= { regular: [], deep: [] };
        const excluded = new Set(p.notApplicable[body.kind]);
        body.applicable ? excluded.delete(body.index) : excluded.add(body.index);
        p.notApplicable[body.kind] = [...excluded];
        setState(optimistic);
      }
    } else if (body.action === "check") {
      const p = optimistic.data.properties.find((p) => p.id === body.id);
      if (
        p &&
        (body.kind === "regular" || body.kind === "deep") &&
        typeof body.index === "number"
      ) {
        const values = new Set(p.checked[body.kind]);
        body.checked ? values.add(body.index) : values.delete(body.index);
        p.checked[body.kind] = [...values];
        setState(optimistic);
      }
    } else if (
      body.action === "legacy-progress" &&
      (body.kind === "regular" || body.kind === "deep")
    ) {
      optimistic.data.legacyProgress ||= {};
      optimistic.data.legacyProgress[body.kind] = body.state as {
        checked: boolean[];
      };
      setState(optimistic);
    }
    try {
      const next = await request<Workspace>("/api/dashboard", {
        ...body,
        revision: current.current.revision,
      });
      accept(next);
      if (body.action === "property" && !body.id)
        setSelected(next.data.properties.at(-1)?.id || "");
      setStatus("Saved to your workspace.");
      return true;
    } catch (e) {
      setState(current.current);
      setStatus(message(e));
      if (e instanceof APIError && e.status === 409) setConflict(true);
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return {
    state,
    selected,
    setSelected,
    ready,
    busy,
    status,
    setStatus,
    conflict,
    load,
    save,
    property: state.data.properties.find((p) => p.id === selected),
  };
}
export type WorkspaceModel = ReturnType<typeof useWorkspace>;

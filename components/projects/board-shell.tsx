"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { NewTaskDialog } from "./task-dialog";
import type { TaskStatus } from "@/lib/db/schema";

/**
 * The "new task" dialog is opened from two places that live in different
 * parts of the page tree — the header button and each Kanban column's +
 * button — so its state lives in a context provider wrapping both rather
 * than being duplicated into two dialog instances.
 */
const TaskDialogContext = createContext<(status: TaskStatus) => void>(() => {});

export function useNewTaskDialog() {
  return useContext(TaskDialogContext);
}

export function TaskDialogProvider({
  projectSlug,
  refPrefix,
  children
}: {
  projectSlug: string;
  refPrefix: string;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<TaskStatus | null>(null);
  const open = useCallback((s: TaskStatus) => setStatus(s), []);
  const close = useCallback(() => setStatus(null), []);
  const value = useMemo(() => open, [open]);

  return (
    <TaskDialogContext.Provider value={value}>
      {children}
      <NewTaskDialog
        open={status !== null}
        onClose={close}
        projectSlug={projectSlug}
        refPrefix={refPrefix}
        defaultStatus={status ?? "To Do"}
      />
    </TaskDialogContext.Provider>
  );
}

/** Header action — rendered inside the provider by the project page. */
export function NewTaskButton() {
  const open = useNewTaskDialog();
  return (
    <button type="button" className="btn-primary" onClick={() => open("To Do")}>
      <Plus size={15} aria-hidden />
      <span>New task</span>
    </button>
  );
}

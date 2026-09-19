"use client";
import { useEffect, useRef, type ReactNode } from "react";
export default function Dialog({
  id,
  title,
  open,
  onClose,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const d = ref.current!;
    if (!open) {
      if (d.open) d.close();
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    d.showModal();
    d.querySelector<HTMLElement>("[autofocus], h2")?.focus();
    return () => {
      if (d.open) d.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={id + "Title"}
      onCancel={() => close.current()}
    >
      <h2 id={id + "Title"} tabIndex={-1}>
        {title}
      </h2>
      {children}
    </dialog>
  );
}

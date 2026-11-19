"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./editor-dialog.module.css";

export function EditorDialog({ title, closeLabel, onClose, children, wide = false }: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    headingRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return <dialog
    ref={dialogRef}
    className={`${styles.dialog} ${wide ? styles.wide : ""}`}
    aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
  >
    <header className={styles.header}>
      <h2 id={titleId} ref={headingRef} tabIndex={-1}>{title}</h2>
      <button type="button" className="button ghost" onClick={onClose}><X size={18} aria-hidden="true" />{closeLabel}</button>
    </header>
    <div className={styles.body}>{children}</div>
  </dialog>;
}

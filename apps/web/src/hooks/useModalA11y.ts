"use client";

import { useEffect, useRef } from "react";

/**
 * Modal a11y baseline (WCAG 2.4.3 Focus Order + 2.1.2 No Keyboard Trap):
 *   - Modal açılınca ilk focusable elemente odaklan
 *   - Tab / Shift+Tab modal içinde döner (focus trap)
 *   - Escape → onClose
 *   - Modal kapanınca opener elemente focus geri döner
 *
 * Kullanım:
 *   const modalRef = useModalA11y({ onClose });
 *   <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="...">
 *
 * `role="dialog"` + `aria-modal="true"` + `aria-labelledby` çağıran
 * component'in sorumluluğunda.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>({
  onClose,
  active = true,
}: { onClose: () => void; active?: boolean; }) {
  const containerRef = useRef<T | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Aç öncesi focus'u sakla
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Modal içinde ilk focusable'a odaklan (delay: layout settle)
    const raf = requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;
      const focusables = getFocusables(el);
      if (focusables.length > 0) focusables[0]!.focus();
      else el.focus();
    });

    function handleKey(e: KeyboardEvent) {
      const el = containerRef.current;
      if (!el) return;

      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusables = getFocusables(el);
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusables[0]!;
        const last  = focusables[focusables.length - 1]!;
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKey);
      // Aç öncesi focus'u geri ver
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === "function") {
        prev.focus();
      }
    };
  }, [active, onClose]);

  return containerRef;
}

/** Modal içindeki tüm focusable elementleri döndürür. */
function getFocusables(root: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type=hidden])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  return Array.from(root.querySelectorAll<HTMLElement>(selector))
    .filter((el) => el.offsetParent !== null || el === document.activeElement);
}

import { type ReactNode, useEffect } from 'react';

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Hides the ✕ and ignores backdrop taps, for modals you must act on. */
  dismissible?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    // Keep the board from scrolling behind the sheet on mobile.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        className="animate-pop-in flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border-4 border-marquee/80 bg-teal-800 shadow-card sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b-2 border-ink/40 bg-teal-900/70 px-4 py-3">
          <h2 className="min-w-0 flex-1 font-display text-lg uppercase tracking-wide text-marquee">
            {title}
          </h2>
          {dismissible && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-cream/40 text-cream transition active:scale-95"
            >
              ✕
            </button>
          )}
        </div>

        <div className="scrollbar-none flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer && (
          <div className="border-t-2 border-ink/40 bg-teal-900/70 px-4 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

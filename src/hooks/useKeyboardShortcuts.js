import { useCallback } from 'react';

export const useKeyboardShortcuts = ({
  onEnter,
  onEscape,
  onTab,
  onBackspace,
  onDelete,
  onArrowUp,
  onArrowDown,
  onArrowLeft,
  onArrowRight,
  onCtrlB,
  onCtrlI,
  onCtrlK,
  onCtrlS,
  onCtrlZ,
  onCtrlY,
  onCtrlShiftH,
  onCtrlShiftL,
  onCtrlShiftC,
  onCtrlShiftQ,
  onCtrlShiftT,
  onCtrlShiftB
}) => {
  return useCallback((e) => {
    // Базовые клавиши
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEnter?.(e);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onEscape?.(e);
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      onTab?.(e);
    }
    if (e.key === 'Backspace') {
      onBackspace?.(e);
    }
    if (e.key === 'Delete') {
      onDelete?.(e);
    }

    // Стрелки
    if (e.key === 'ArrowUp') {
      onArrowUp?.(e);
    }
    if (e.key === 'ArrowDown') {
      onArrowDown?.(e);
    }
    if (e.key === 'ArrowLeft') {
      onArrowLeft?.(e);
    }
    if (e.key === 'ArrowRight') {
      onArrowRight?.(e);
    }

    // Комбинации с Ctrl/Cmd
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      if (e.key === 'b') {
        e.preventDefault();
        onCtrlB?.(e);
      }
      if (e.key === 'i') {
        e.preventDefault();
        onCtrlI?.(e);
      }
      if (e.key === 'k') {
        e.preventDefault();
        onCtrlK?.(e);
      }
      if (e.key === 's') {
        e.preventDefault();
        onCtrlS?.(e);
      }
      if (e.key === 'z') {
        e.preventDefault();
        onCtrlZ?.(e);
      }
      if (e.key === 'y') {
        e.preventDefault();
        onCtrlY?.(e);
      }
    }

    // Комбинации с Ctrl/Cmd + Shift
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey) {
      if (e.key === 'H') {
        e.preventDefault();
        onCtrlShiftH?.(e);
      }
      if (e.key === 'L') {
        e.preventDefault();
        onCtrlShiftL?.(e);
      }
      if (e.key === 'C') {
        e.preventDefault();
        onCtrlShiftC?.(e);
      }
      if (e.key === 'Q') {
        e.preventDefault();
        onCtrlShiftQ?.(e);
      }
      if (e.key === 'T') {
        e.preventDefault();
        onCtrlShiftT?.(e);
      }
      if (e.key === 'B') {
        e.preventDefault();
        onCtrlShiftB?.(e);
      }
    }
  }, [
    onEnter,
    onEscape,
    onTab,
    onBackspace,
    onDelete,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onCtrlB,
    onCtrlI,
    onCtrlK,
    onCtrlS,
    onCtrlZ,
    onCtrlY,
    onCtrlShiftH,
    onCtrlShiftL,
    onCtrlShiftC,
    onCtrlShiftQ,
    onCtrlShiftT,
    onCtrlShiftB
  ]);
}; 
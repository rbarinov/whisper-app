import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DOM_CODE_TO_DISPLAY_NAME,
  DOM_CODE_TO_MAC_KEYCODE,
  DOM_CODE_TO_UIOHOOK_KEYCODE,
  MODIFIER_ONLY_DOM_CODES,
} from '../../shared/key-maps';
import type { HotkeyModifiers } from '../../shared/types';

interface KeyCaptureButtonProps {
  label: string;
  keyName: string;
  onCapture: (keyCode: number, keyName: string, modifiers: Required<HotkeyModifiers>) => void;
}

const CAPTURE_TIMEOUT_MS = 5000;

function isMacOS(): boolean {
  return navigator.userAgent.includes('Mac');
}

function resolveKeyCode(domCode: string): number | null {
  const map = isMacOS() ? DOM_CODE_TO_MAC_KEYCODE : DOM_CODE_TO_UIOHOOK_KEYCODE;
  return map[domCode] ?? null;
}

function resolveKeyName(domCode: string, fallbackKey: string): string {
  return DOM_CODE_TO_DISPLAY_NAME[domCode] ?? fallbackKey;
}

export function KeyCaptureButton({ label, keyName, onCapture }: KeyCaptureButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const stopCapture = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  const startCapture = useCallback(() => {
    setIsCapturing(true);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      stopCapture();
    }, CAPTURE_TIMEOUT_MS);
  }, [stopCapture]);

  useEffect(() => {
    if (!isCapturing) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (MODIFIER_ONLY_DOM_CODES.has(event.code)) {
        return;
      }

      const resolvedCode = resolveKeyCode(event.code);
      if (resolvedCode === null) {
        return;
      }

      const resolvedName = resolveKeyName(event.code, event.key);
      onCapture(resolvedCode, resolvedName, {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      });
      stopCapture();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isCapturing, onCapture, stopCapture]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const helperText = useMemo(() => {
    if (isCapturing) {
      return 'Press a key combination...';
    }
    return `Current: ${keyName}`;
  }, [isCapturing, keyName]);

  return (
    <button
      type="button"
      className={`w-full rounded-[16px] border bg-white/80 px-3 py-2.5 text-left transition-all duration-200 ${
        isCapturing
          ? 'border-[#0f766e]/45 shadow-[0_0_0_4px_rgba(15,118,110,0.16)]'
          : 'border-[#15231e]/10 hover:border-[#15231e]/18 hover:bg-white'
      }`}
      onClick={startCapture}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#16211b]">{label}</p>
          <p className="mt-1 text-xs text-[#4b5650]">{isCapturing ? 'Listening for key input' : 'Click to remap'}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isCapturing ? <span className="keycap text-[14px] min-h-[40px] min-w-[68px]">{keyName}</span> : null}
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4b5650]">{helperText}</span>
        </div>
      </div>
    </button>
  );
}

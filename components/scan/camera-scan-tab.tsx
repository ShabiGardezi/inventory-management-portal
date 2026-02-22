'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import type { Result } from '@zxing/library';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: 'environment' },
};

export interface CameraScanTabProps {
  onLookupSuccess: (code: string) => void;
  scanningPaused: boolean;
  onSwitchToManual: () => void;
}

function hasMediaDevices(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

function isSecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

export function CameraScanTab({
  onLookupSuccess,
  scanningPaused,
  onSwitchToManual,
}: CameraScanTabProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'requesting' | 'scanning' | 'denied' | 'unavailable'
  >('idle');
  const [retryKey, setRetryKey] = useState(0);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const stopScanner = useCallback(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {
        // ignore
      }
      controlsRef.current = null;
    }
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startDecoding = useCallback(() => {
    const video = videoRef.current;
    if (!video || !hasMediaDevices() || !isSecureContext()) {
      setStatus('unavailable');
      return;
    }

    setStatus('requesting');
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader
      .decodeFromConstraints(
        CAMERA_CONSTRAINTS,
        video,
        (result: Result | undefined, _error: unknown, controls: IScannerControls) => {
          controlsRef.current = controls;
          if (result) {
            try {
              controls.stop();
              controlsRef.current = null;
              const text = result.getText();
              if (text) {
                setStatus('idle');
                onLookupSuccess(text);
              }
            } catch {
              // ignore
            }
          }
        }
      )
      .then((controls) => {
        controlsRef.current = controls;
        const stream = video.srcObject;
        if (stream instanceof MediaStream) {
          streamRef.current = stream;
        }
        setStatus('scanning');
      })
      .catch((err: unknown) => {
        readerRef.current = null;
        const name = err instanceof Error ? err.name : '';
        const msg = err instanceof Error ? err.message : String(err);
        if (
          name === 'NotAllowedError' ||
          name === 'PermissionDeniedError' ||
          /permission|denied|not allowed/i.test(msg)
        ) {
          setStatus('denied');
        } else {
          setStatus('unavailable');
        }
      });
  }, [onLookupSuccess]);

  useEffect(() => {
    if (scanningPaused) {
      stopScanner();
      return;
    }
    startDecoding();
    return () => {
      stopScanner();
      readerRef.current = null;
    };
  }, [scanningPaused, startDecoding, stopScanner, retryKey]);

  if (!hasMediaDevices() || !isSecureContext()) {
    return (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 px-3 py-3 text-sm text-amber-800 dark:text-amber-200 space-y-2">
        <p>Camera scan is not available (requires HTTPS and camera access).</p>
        <Button variant="outline" size="sm" onClick={onSwitchToManual} className="gap-2">
          <Keyboard className="h-4 w-4" />
          Enter code instead
        </Button>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 px-3 py-3 text-sm text-amber-800 dark:text-amber-200 space-y-2">
        <p>Camera access was denied. You can enter the code manually instead.</p>
        <Button variant="outline" size="sm" onClick={onSwitchToManual} className="gap-2">
          <Keyboard className="h-4 w-4" />
          Enter code instead
        </Button>
      </div>
    );
  }

  if (status === 'unavailable') {
    return (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 px-3 py-3 text-sm text-amber-800 dark:text-amber-200 space-y-2">
        <p>Camera could not be started. Try again or enter the code manually.</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatus('requesting');
              setRetryKey((k) => k + 1);
            }}
          >
            Try again
          </Button>
          <Button variant="outline" size="sm" onClick={onSwitchToManual} className="gap-2">
            <Keyboard className="h-4 w-4" />
            Enter code
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border bg-muted">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        {(status === 'requesting' || status === 'idle') && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80 text-sm text-muted-foreground">
            {status === 'requesting' ? 'Requesting camera…' : 'Point at a barcode'}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Point your camera at a barcode. Scanning pauses after a successful read; use “Scan another” to continue.
      </p>
    </div>
  );
}

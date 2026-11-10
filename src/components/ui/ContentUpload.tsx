'use client';
import { useId, useRef, useState } from 'react';
import { useViewer } from '@/store/viewerStore';
import { Button, Icon, cx, focusRing } from './primitives';

const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB – object URLs stream from disk, but keep a sane cap

/** Upload an image or video to project onto the screen(s). Files never leave the browser. */
export function ContentUpload() {
  const content = useViewer((s) => s.content);
  const paused = useViewer((s) => s.videoPaused);
  const muted = useViewer((s) => s.videoMuted);
  const { setContent, setVideoPaused, setVideoMuted, toast } = useViewer.getState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const onFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setError('That file is larger than 1 GB.');
    if (file.type.startsWith('image/')) {
      setContent({ kind: 'image', url: URL.createObjectURL(file), name: file.name });
      toast('success', `Showing “${file.name}” on screen.`);
    } else if (file.type.startsWith('video/')) {
      const probe = document.createElement('video');
      if (!probe.canPlayType(file.type)) {
        return setError(`This browser can’t play ${file.type || 'this video type'}. Try MP4 (H.264) or WebM.`);
      }
      setContent({ kind: 'video', url: URL.createObjectURL(file), name: file.name });
      toast('success', `Playing “${file.name}” on screen.`);
    } else {
      setError('Unsupported file. Choose an image (JPG, PNG, WebP) or a video (MP4, WebM).');
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/55">
        Default: generated cinematic visuals. Upload your own image or video — it stays on this device.
      </p>
      <div
        className="rounded-xl border border-dashed border-white/15 bg-black/20 p-4 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFile(e.dataTransfer.files?.[0]);
        }}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime"
          className="sr-only"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <label
          htmlFor={id}
          className={cx(
            'inline-flex cursor-pointer items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20',
            focusRing,
          )}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <Icon name="upload" /> Choose image or video
        </label>
        <p className="mt-2 text-[11px] text-white/35">or drop a file here</p>
      </div>
      {error && (
        <p role="alert" className="text-xs text-rose-300">
          {error}
        </p>
      )}
      {content.kind !== 'procedural' && (
        <div className="flex items-center gap-2 rounded-xl bg-black/30 p-2 pl-3">
          <span className="min-w-0 flex-1 truncate text-xs text-white/75" title={content.name}>
            {content.kind === 'video' ? '🎬' : '🖼'} {content.name}
          </span>
          {content.kind === 'video' && (
            <>
              <button
                type="button"
                aria-label={paused ? 'Play video' : 'Pause video'}
                onClick={() => setVideoPaused(!paused)}
                className={cx('rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white', focusRing)}
              >
                <Icon name={paused ? 'play' : 'pause'} />
              </button>
              <button
                type="button"
                aria-label={muted ? 'Unmute video' : 'Mute video'}
                onClick={() => setVideoMuted(!muted)}
                className={cx('rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white', focusRing)}
              >
                <Icon name={muted ? 'mute' : 'volume'} />
              </button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => setContent({ kind: 'procedural' })}>
            Use generated
          </Button>
        </div>
      )}
    </div>
  );
}

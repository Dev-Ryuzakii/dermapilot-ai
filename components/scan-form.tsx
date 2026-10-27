'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Check, ShieldCheck, UploadCloud, Video, VideoOff, X } from 'lucide-react';
import type { FaceDetector } from '@mediapipe/tasks-vision';
import { faceCrop, type CropBox, type FaceBox } from '@/lib/face-crop';

async function responseError(response: Response): Promise<string> {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const payload = await response.json().catch(() => null);
    return payload?.error || payload?.message || `The request failed (${response.status}).`;
  }
  if (response.status === 502 || response.status === 503 || response.status === 504) return 'The scan service is temporarily unavailable. Your image was not analyzed. Please try again shortly.';
  const text = await response.text().catch(() => '');
  return text.includes('<!DOCTYPE') || text.includes('<html') ? `The app server returned an unexpected page (${response.status}). Refresh and retry.` : `The request failed (${response.status}).`;
}

export default function ScanForm() {
  const input = useRef<HTMLInputElement>(null);
  const originalFile = useRef<File | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const cropRef = useRef<CropBox | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [qualityNotice, setQualityNotice] = useState('');
  const [camera, setCamera] = useState(false);
  const [faceBox, setFaceBox] = useState<FaceBox | null>(null);
  const [cameraHint, setCameraHint] = useState('Starting face guide…');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const stopCamera = useCallback(() => {
    detectorRef.current?.close();
    detectorRef.current = null;
    cropRef.current = null;
    setFaceBox(null);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (video.current) video.current.srcObject = null;
    setCamera(false);
  }, []);

  useEffect(() => {
    if (!camera || !streamRef.current || !video.current) return;
    const element = video.current;
    let cancelled = false;
    let frame = 0;
    let lastCheck = 0;
    element.srcObject = streamRef.current;
    element.muted = true;
    element.playsInline = true;
    const play = () => { void element.play().catch(() => setError('The camera opened but the preview did not start. Check browser camera permissions and retry.')); };
    element.onloadedmetadata = play;
    if (element.readyState >= 1) play();
    async function guide() {
      try {
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        const detector = await FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: '/mediapipe/models/blaze_face_short_range.tflite' },
          runningMode: 'VIDEO', minDetectionConfidence: 0.55,
        });
        if (cancelled) { detector.close(); return; }
        detectorRef.current = detector;
        const tick = (now: number) => {
          if (cancelled) return;
          if (now - lastCheck >= 160 && element.readyState >= 2 && element.videoWidth > 0) {
            lastCheck = now;
            try {
              // TFLite writes this harmless CPU initialization notice to console.error.
              // Next's dev overlay otherwise presents it as a runtime error.
              const reportError = console.error;
              let faces;
              try {
                console.error = (...args: unknown[]) => {
                  if (args.length === 1 && typeof args[0] === 'string' && args[0].includes('INFO: Created TensorFlow Lite XNNPACK delegate for CPU.')) return;
                  reportError(...args);
                };
                faces = detector.detectForVideo(element, now).detections;
              } finally {
                console.error = reportError;
              }
              const box = faces.length === 1 ? faces[0].boundingBox : undefined;
              const crop = box ? faceCrop(element.videoWidth, element.videoHeight, box) : null;
              cropRef.current = crop;
              setFaceBox(box ?? null);
              setCameraHint(faces.length > 1 ? 'Only one face should be in the frame.' : !box ? 'Center your face in the camera.' : !crop ? 'Move closer and keep your whole face in view.' : 'Face ready. Capture will crop automatically.');
            } catch {
              cropRef.current = null;
              setCameraHint('Face guide paused. Try closing and reopening the camera.');
            }
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setCameraHint('Face guide could not load. You can still capture and crop the photo manually.');
      }
    }
    void guide();
    return () => { cancelled = true; cancelAnimationFrame(frame); element.onloadedmetadata = null; detectorRef.current?.close(); detectorRef.current = null; cropRef.current = null; };
  }, [camera]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function setSelectedImage(image?: File, keepOriginal = false) {
    if (!image) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size < 1 || image.size > 8 * 1024 * 1024) {
      setError('Choose a JPEG, PNG, or WebP image under 8 MB.'); return;
    }
    const nextPreview = URL.createObjectURL(image);
    const source = new Image();
    source.src = nextPreview;
    try { await source.decode(); } catch { URL.revokeObjectURL(nextPreview); setError('This image could not be opened. Choose another photo.'); return; }
    if (preview) URL.revokeObjectURL(preview);
    if (!keepOriginal) originalFile.current = image;
    setFile(image); setPreview(nextPreview);
    setDimensions({ width: source.naturalWidth, height: source.naturalHeight });
    setQualityNotice('');
    setError(Math.min(source.naturalWidth, source.naturalHeight) < 480
      ? `This photo is ${source.naturalWidth}×${source.naturalHeight}. YouCam needs at least 480 pixels on the shorter side. Choose a larger photo or use the enlargement option below.`
      : '');
    stopCamera();
  }

  async function enlargePhoto() {
    if (!preview || !dimensions || Math.min(dimensions.width, dimensions.height) < 360) {
      setError('This photo has too little detail to enlarge for analysis. Take a new, higher-resolution photo.'); return;
    }
    try {
      const source = new Image(); source.src = preview; await source.decode();
      const scale = Math.min(720 / Math.min(source.naturalWidth, source.naturalHeight), 2560 / Math.max(source.naturalWidth, source.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(source.naturalWidth * scale); canvas.height = Math.round(source.naturalHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare this photo.');
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Could not prepare this photo.');
      await setSelectedImage(new File([blob], 'skin-scan-enlarged.jpg', { type: 'image/jpeg' }), true);
      setQualityNotice('Enlarged for YouCam’s size requirement. Enlargement does not restore detail, so a fresh camera photo may give more reliable results.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not enlarge this photo.'); }
  }

  async function cropCloser() {
    if (!file || !preview) return;
    try {
      const source = new Image();
      source.src = preview;
      await source.decode();
      const shortest = Math.min(source.naturalWidth, source.naturalHeight);
      if (shortest < 480) throw new Error('This photo is too small to crop. Use a higher-resolution, closer photo.');
      const fraction = Math.max(0.62, 480 / shortest);
      if (fraction >= 0.95) throw new Error('This photo cannot be cropped much further. Move closer to the camera and take a new photo.');
      const width = Math.round(source.naturalWidth * fraction);
      const height = Math.round(source.naturalHeight * fraction);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare the closer crop. Try another photo.');
      context.drawImage(source, (source.naturalWidth - width) / 2, (source.naturalHeight - height) / 2, width, height, 0, 0, width, height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) throw new Error('Could not prepare the closer crop. Try another photo.');
      setSelectedImage(new File([blob], 'skin-scan-cropped.jpg', { type: 'image/jpeg' }), true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not crop this photo. Try another image.');
    }
  }

  async function startCamera() {
    setError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setError('Camera capture needs a secure HTTPS page and browser camera support. You can upload a photo instead.'); return; }
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } } });
      streamRef.current = stream;
      setCamera(true);
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : '';
      setError(name === 'NotAllowedError' ? 'Camera permission is blocked. Allow camera access in browser site settings, then try again.' : name === 'NotFoundError' ? 'No camera was detected. You can upload a photo instead.' : 'Could not start the camera. Check if another app is using it.');
    }
  }

  function capture() {
    const element = video.current;
    if (!element || element.videoWidth < 1 || element.videoHeight < 1) { setError('The camera feed is still starting. Wait until you see the preview, then capture.'); return; }
    if (detectorRef.current && !cropRef.current) { setError('Center your face and move closer until the guide says it is ready.'); return; }
    const crop = cropRef.current ?? { x: 0, y: 0, width: element.videoWidth, height: element.videoHeight };
    const canvas = document.createElement('canvas'); canvas.width = crop.width; canvas.height = crop.height;
    const context = canvas.getContext('2d');
    if (!context) { setError('Could not capture this frame. Please upload a photo instead.'); return; }
    context.drawImage(element, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (blob) setSelectedImage(new File([blob], `dermapilot-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      else setError('Could not prepare the camera image. Please retry.');
    }, 'image/jpeg', 0.92);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!file) { setError('Upload or capture a selfie first.'); return; }
    if (!dimensions || Math.min(dimensions.width, dimensions.height) < 480) { setError('Use a photo with at least 480 pixels on its shorter side, or enlarge this one first.'); return; }
    if (!consent) { setError('Please confirm consent before processing your image.'); return; }
    setBusy(true);
    try {
      const data = new FormData(); data.set('image', file); data.set('consent', 'true');
      const response = await fetch('/api/scan', { method: 'POST', body: data, credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = await response.json().catch(() => null);
      if (!payload?.assessment_id) throw new Error('The scan service did not return a saved result. Please retry.');
      if (payload.snapshot_warning) sessionStorage.setItem(`snapshot-warning:${payload.assessment_id}`, payload.snapshot_warning);
      router.push(`/dashboard/results?id=${encodeURIComponent(payload.assessment_id)}`); router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The scan could not be submitted. Please retry.');
    } finally { setBusy(false); }
  }

  return <section className="surface-card max-w-3xl p-5 sm:p-7">
    <p className="mb-5 text-sm leading-6 text-[var(--muted)]">Use a clear, front-facing photo in even light. Keep your whole face visible and make it fill about 60–80% of the photo width. The shorter side must be at least 480 pixels.</p>
    <div className="mb-5 flex flex-wrap gap-3">
      <button type="button" onClick={() => input.current?.click()} className="secondary-button inline-flex items-center gap-2"><UploadCloud size={17}/>Upload image</button>
      {!camera ? <button type="button" onClick={startCamera} className="secondary-button inline-flex items-center gap-2"><Video size={17}/>Use camera</button> : <button type="button" onClick={stopCamera} className="secondary-button inline-flex items-center gap-2"><VideoOff size={17}/>Close camera</button>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="sr-only" onChange={event => setSelectedImage(event.target.files?.[0])}/>
    </div>
    {camera && <div className="relative mb-5 overflow-hidden rounded-2xl bg-[#15251e]"><div className="relative"><video ref={video} autoPlay muted playsInline className="block w-full"/>{faceBox && video.current?.videoWidth ? <div aria-hidden="true" className={`pointer-events-none absolute rounded-[35%] border-2 ${cropRef.current ? 'border-emerald-300' : 'border-amber-300'}`} style={{ left: `${faceBox.originX / video.current.videoWidth * 100}%`, top: `${faceBox.originY / video.current.videoHeight * 100}%`, width: `${faceBox.width / video.current.videoWidth * 100}%`, height: `${faceBox.height / video.current.videoHeight * 100}%` }}/> : null}</div><div className="flex flex-wrap items-center justify-between gap-3 p-4"><p role="status" className="text-sm text-white">{cameraHint}</p><button type="button" onClick={capture} className="primary-button inline-flex items-center gap-2"><Camera size={17}/>Capture selfie</button></div></div>}
    {preview && <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--soft)]"><img src={preview} alt="Selected selfie preview" className="mx-auto max-h-[420px] w-full object-contain"/><div className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="min-w-0 break-all">{file?.name} {dimensions && `· ${dimensions.width}×${dimensions.height}`}</span><div className="flex flex-wrap items-center gap-x-3 gap-y-2">{dimensions && Math.min(dimensions.width, dimensions.height) < 480 && <button type="button" onClick={enlargePhoto} className="font-semibold text-[var(--brand)]">Enlarge for analysis</button>}<button type="button" onClick={cropCloser} className="font-semibold text-[var(--brand)]">Crop closer</button>{originalFile.current && file !== originalFile.current && <button type="button" onClick={() => setSelectedImage(originalFile.current || undefined, true)} className="font-semibold text-[var(--muted)]">Reset crop</button>}<button type="button" onClick={() => { URL.revokeObjectURL(preview); setPreview(''); setFile(null); setDimensions(null); setQualityNotice(''); originalFile.current = null; }} aria-label="Remove image" className="icon-button"><X size={17}/></button></div></div></div>}
    {!preview && !camera && <button type="button" onClick={() => input.current?.click()} className="mb-5 flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--soft)]/60 p-6 text-center transition hover:border-[var(--brand)]"><span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white text-[var(--brand)]"><Camera/></span><span className="font-semibold">Choose a selfie to begin</span><span className="mt-1 text-sm text-[var(--muted)]">JPEG, PNG, or WebP, up to 8 MB</span></button>}
    <form onSubmit={submit} className="space-y-4">
      <label className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 text-sm leading-6"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 accent-[var(--brand)]"/><span><strong>I consent to image processing and private snapshot storage.</strong> Your selfie is sent to YouCam for cosmetic analysis. Your account saves scores, the photo used for this scan, and available spotted-area overlays in private Afribase Storage. If Storage is unavailable, the scan still saves scores and temporary YouCam image links. This is not a medical diagnosis.</span></label>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {qualityNotice && <p role="status" className="rounded-xl bg-[var(--mint)] p-3 text-sm text-[var(--brand-dark)]">{qualityNotice}</p>}
      <button disabled={busy || !file || !consent || !dimensions || Math.min(dimensions.width, dimensions.height) < 480} className="primary-button inline-flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Analyzing your selfie…' : 'Analyze my skin'}</button>
      <p className="flex items-center gap-2 text-xs text-[var(--muted)]"><ShieldCheck size={15}/>Scan results are private to your account. Cosmetic guidance only.</p>
    </form>
  </section>;
}

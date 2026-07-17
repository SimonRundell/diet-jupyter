/**
 * usePyodide.js
 * React hook that owns the Pyodide web worker: boots it, queues cell runs,
 * routes streamed output back to the caller, and supports a hard restart
 * (the only way to stop a runaway loop without SharedArrayBuffer headers).
 * Licensed under CC BY-NC-SA 4.0.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @param {string} pyodideUrl Base CDN URL for the Pyodide distribution.
 * @returns {{
 *   status: 'loading'|'ready'|'running'|'error',
 *   error: string|null,
 *   runCell: (id: string, code: string,
 *             onStream: (name: string, text: string) => void)
 *            => Promise<{result: string|null, images: string[], error: string|null}>,
 *   restart: () => void,
 * }}
 */
export function usePyodide(pyodideUrl) {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const workerRef = useRef(null);
  const pendingRef = useRef(null); // { id, onStream, resolve }
  const queueRef = useRef([]); // queued { id, code, onStream, resolve }

  /** Send the next queued run to the worker, if idle. */
  const pump = useCallback(() => {
    if (pendingRef.current || queueRef.current.length === 0) return;
    const job = queueRef.current.shift();
    pendingRef.current = job;
    setStatus('running');
    workerRef.current.postMessage({ type: 'run', id: job.id, code: job.code });
  }, []);

  /** Create (or recreate) the worker and wire up its message handling. */
  const boot = useCallback(() => {
    if (workerRef.current) workerRef.current.terminate();
    // Fail any in-flight or queued runs from a previous worker.
    const stopped = { result: null, images: [], error: 'Kernel restarted' };
    if (pendingRef.current) pendingRef.current.resolve(stopped);
    queueRef.current.forEach((job) => job.resolve(stopped));
    pendingRef.current = null;
    queueRef.current = [];

    setStatus('loading');
    setError(null);
    const worker = new Worker(`${import.meta.env.BASE_URL}pyodide-worker.js`);
    workerRef.current = worker;
    worker.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === 'ready') {
        setStatus('ready');
      } else if (msg.type === 'init-error') {
        setStatus('error');
        setError(msg.message);
      } else if (msg.type === 'stream') {
        pendingRef.current?.onStream(msg.name, msg.text);
      } else if (msg.type === 'done') {
        const job = pendingRef.current;
        pendingRef.current = null;
        setStatus('ready');
        job?.resolve({ result: msg.result, images: msg.images, error: msg.error });
        pump();
      }
    };
    worker.postMessage({ type: 'init', pyodideUrl });
  }, [pyodideUrl, pump]);

  useEffect(() => {
    boot();
    return () => workerRef.current?.terminate();
  }, [boot]);

  const runCell = useCallback(
    (id, code, onStream) =>
      new Promise((resolve) => {
        queueRef.current.push({ id, code, onStream, resolve });
        pump();
      }),
    [pump]
  );

  return { status, error, runCell, restart: boot };
}

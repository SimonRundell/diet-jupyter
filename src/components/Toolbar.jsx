/**
 * Toolbar.jsx
 * Top bar: file name, kernel status, run-all / restart / download / close.
 * Licensed under CC BY-NC-SA 4.0.
 */

/** Human-readable labels for kernel states. */
const STATUS_LABELS = {
  loading: 'Loading Python…',
  ready: 'Ready',
  running: 'Running…',
  error: 'Kernel error',
};

/**
 * @param {Object} props
 * @param {string} props.appTitle
 * @param {string|null} props.fileName
 * @param {'loading'|'ready'|'running'|'error'} props.status
 * @param {() => void} props.onRunAll
 * @param {() => void} props.onRestart
 * @param {() => void} props.onDownload
 * @param {() => void} props.onClose
 */
export default function Toolbar({
  appTitle,
  fileName,
  status,
  onRunAll,
  onRestart,
  onDownload,
  onClose,
}) {
  const ready = status === 'ready';
  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <img
          className="app-logo"
          src={`${import.meta.env.BASE_URL}favicon.png`}
          alt=""
        />
        <span className="app-title">{appTitle}</span>
        {fileName && <span className="file-name">{fileName}</span>}
      </div>
      {fileName && (
        <div className="toolbar-actions">
          <button type="button" disabled={!ready} onClick={onRunAll}>
            Run all
          </button>
          <button type="button" className="secondary" onClick={onRestart}>
            Restart kernel
          </button>
          <button type="button" className="secondary" onClick={onDownload}>
            Download .ipynb
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Close notebook
          </button>
        </div>
      )}
      <span className={`kernel-status status-${status}`}>
        {STATUS_LABELS[status]}
      </span>
    </header>
  );
}

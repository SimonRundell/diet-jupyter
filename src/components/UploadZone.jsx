/**
 * UploadZone.jsx
 * Landing panel: drag-drop or pick a .ipynb file, or load the sample.
 * Licensed under CC BY-NC-SA 4.0.
 */

import { useRef, useState } from 'react';

/**
 * @param {Object} props
 * @param {(file: File) => void} props.onFile        Called with the chosen file.
 * @param {() => void} props.onLoadSample            Load the bundled sample notebook.
 * @param {boolean} props.hasSample                  Whether a sample is configured.
 */
export default function UploadZone({ onFile, onLoadSample, hasSample }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  /** Route a dropped or picked file to the parent. */
  const handleFiles = (files) => {
    if (files && files.length > 0) onFile(files[0]);
  };

  return (
    <div
      className={`upload-zone${dragOver ? ' drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <img className="diet-logo" src="/favicon.png" alt="Diet Jupyter logo" />
      <p className="upload-title">Drop a notebook here</p>
      <p className="upload-hint">.ipynb files only — everything runs in your browser</p>
      <div className="upload-actions">
        <button type="button" onClick={() => inputRef.current.click()}>
          Choose file
        </button>
        {hasSample && (
          <button type="button" className="secondary" onClick={onLoadSample}>
            Load sample notebook
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".ipynb,application/json"
        className="visually-hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

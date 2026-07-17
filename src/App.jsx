/**
 * App.jsx
 * Diet Jupyter — a minimal client-side runner for Jupyter notebooks.
 * Students upload a .ipynb, edit and run code cells against Pyodide,
 * then download their modified copy. Nothing is stored server-side.
 * Licensed under CC BY-NC-SA 4.0.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Toolbar from './components/Toolbar';
import MarkdownCell from './components/MarkdownCell';
import CodeCell from './components/CodeCell';
import UploadZone from './components/UploadZone';
import { usePyodide } from './hooks/usePyodide';
import CMFloatAd from './cmFloatAd';
import { parseNotebook, serialiseNotebook, stripAnsi } from './utils/notebook';
import './App.css';

/** Fallbacks used when .config.json is missing or unreadable. */
const DEFAULT_CONFIG = {
  appTitle: 'Diet Jupyter',
  pyodideUrl: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
  sampleNotebook: '',
};

/** Build an empty code cell for "add cell". */
function newCodeCell() {
  return {
    id: crypto.randomUUID(),
    cellType: 'code',
    source: '',
    outputs: [],
    execCount: null,
  };
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [notebook, setNotebook] = useState(null); // { metadata, nbformat, nbformatMinor, cells }
  const [fileName, setFileName] = useState(null);
  const [busyCellId, setBusyCellId] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const execCounterRef = useRef(0); // shared In [n] counter

  // Mirror of notebook state so async runs can read the latest cell source.
  const notebookRef = useRef(null);
  useEffect(() => {
    notebookRef.current = notebook;
  }, [notebook]);

  // Live per-cell source, updated synchronously on every editor change so a
  // run can never see stale state (React commits lag behind fast input).
  const sourcesRef = useRef(new Map());

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}.config.json`)
      .then((res) => (res.ok ? res.json() : DEFAULT_CONFIG))
      .then((cfg) => setConfig({ ...DEFAULT_CONFIG, ...cfg }))
      .catch(() => setConfig(DEFAULT_CONFIG));
  }, []);

  const { status, error, runCell, restart } = usePyodide(
    (config || DEFAULT_CONFIG).pyodideUrl
  );

  /** Replace one cell by id via an updater function. */
  const updateCell = useCallback((id, updater) => {
    setNotebook((nb) => ({
      ...nb,
      cells: nb.cells.map((c) => (c.id === id ? updater(c) : c)),
    }));
  }, []);

  /** Load notebook JSON text into state. */
  const loadText = useCallback((text, name) => {
    try {
      setNotebook(parseNotebook(text));
      setFileName(name);
      setLoadError(null);
      execCounterRef.current = 0;
      sourcesRef.current = new Map();
    } catch (err) {
      setLoadError(`Could not open ${name}: ${err.message}`);
    }
  }, []);

  /** Handle an uploaded or dropped File. */
  const handleFile = useCallback(
    (file) => {
      file.text().then((text) => loadText(text, file.name));
    },
    [loadText]
  );

  /** Fetch and open the bundled sample notebook. */
  const loadSample = useCallback(() => {
    const path = config.sampleNotebook;
    fetch(`${import.meta.env.BASE_URL}${path}`)
      .then((res) => res.text())
      .then((text) => loadText(text, path.split('/').pop()))
      .catch((err) => setLoadError(`Could not load sample: ${err.message}`));
  }, [config, loadText]);

  /**
   * Run one code cell by id and stream its output into state.
   * Reads the cell's latest source from state at call time.
   * @returns {Promise<boolean>} true when the cell ran without error.
   */
  const runOne = useCallback(
    async (id) => {
      const source =
        sourcesRef.current.get(id) ??
        notebookRef.current?.cells.find((c) => c.id === id)?.source ??
        '';
      setBusyCellId(id);
      updateCell(id, (c) => ({ ...c, outputs: [] }));
      const onStream = (name, text) => {
        updateCell(id, (c) => {
          const outputs = [...c.outputs];
          const last = outputs[outputs.length - 1];
          if (last && last.kind === 'stream' && last.name === name) {
            outputs[outputs.length - 1] = { ...last, text: last.text + text + '\n' };
          } else {
            outputs.push({ kind: 'stream', name, text: text + '\n' });
          }
          return { ...c, outputs };
        });
      };
      const { result, images, error: runError } = await runCell(id, source, onStream);
      const count = ++execCounterRef.current;
      updateCell(id, (c) => {
        const outputs = [...c.outputs];
        images.forEach((b64) => outputs.push({ kind: 'image', b64 }));
        if (result !== null) outputs.push({ kind: 'result', text: result });
        if (runError !== null)
          outputs.push({ kind: 'error', text: stripAnsi(runError) });
        return { ...c, outputs, execCount: count };
      });
      setBusyCellId(null);
      return runError === null;
    },
    [runCell, updateCell]
  );

  /** Run every code cell top to bottom, stopping on the first error. */
  const runAll = useCallback(async () => {
    const ids = notebook.cells
      .filter((c) => c.cellType === 'code')
      .map((c) => c.id);
    for (const id of ids) {
      const ok = await runOne(id);
      if (!ok) break;
    }
  }, [notebook, runOne]);

  /** Download the current notebook state as a .ipynb file. */
  const download = useCallback(() => {
    const blob = new Blob([serialiseNotebook(notebook)], {
      type: 'application/x-ipynb+json',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName || 'notebook.ipynb';
    link.click();
    URL.revokeObjectURL(link.href);
  }, [notebook, fileName]);

  /** Swap a cell with its neighbour above (delta -1) or below (delta +1). */
  const moveCell = useCallback((id, delta) => {
    setNotebook((nb) => {
      const cells = [...nb.cells];
      const index = cells.findIndex((c) => c.id === id);
      const target = index + delta;
      if (target < 0 || target >= cells.length) return nb;
      [cells[index], cells[target]] = [cells[target], cells[index]];
      return { ...nb, cells };
    });
  }, []);

  const deleteCell = useCallback((id) => {
    setNotebook((nb) => ({ ...nb, cells: nb.cells.filter((c) => c.id !== id) }));
  }, []);

  const addCellBelow = useCallback((id) => {
    setNotebook((nb) => {
      const cells = [...nb.cells];
      const index = cells.findIndex((c) => c.id === id);
      cells.splice(index + 1, 0, newCodeCell());
      return { ...nb, cells };
    });
  }, []);

  const closeNotebook = useCallback(() => {
    setNotebook(null);
    setFileName(null);
  }, []);

  if (!config) return null;

  return (
    <div className="app">
      <Toolbar
        appTitle={config.appTitle}
        fileName={fileName}
        status={status}
        onRunAll={runAll}
        onRestart={restart}
        onDownload={download}
        onClose={closeNotebook}
      />
      <main className="notebook">
        {status === 'error' && (
          <p className="banner banner-error">Python failed to load: {error}</p>
        )}
        {loadError && <p className="banner banner-error">{loadError}</p>}
        {!notebook ? (
          <UploadZone
            onFile={handleFile}
            onLoadSample={loadSample}
            hasSample={Boolean(config.sampleNotebook)}
          />
        ) : (
          notebook.cells.map((cell) => (
            <div key={cell.id} className="cell-row">
              <div className="cell-content">
                {cell.cellType === 'markdown' ? (
                  <MarkdownCell source={cell.source} />
                ) : cell.cellType === 'code' ? (
                  <CodeCell
                    cell={cell}
                    busy={busyCellId === cell.id}
                    kernelReady={status === 'ready'}
                    onChange={(source) => {
                      sourcesRef.current.set(cell.id, source);
                      updateCell(cell.id, (c) => ({ ...c, source }));
                    }}
                    onRun={() => runOne(cell.id)}
                  />
                ) : (
                  <pre className="raw-cell">{cell.source}</pre>
                )}
              </div>
              <div className="cell-tools">
                <button type="button" title="Move up" onClick={() => moveCell(cell.id, -1)}>
                  ↑
                </button>
                <button type="button" title="Move down" onClick={() => moveCell(cell.id, 1)}>
                  ↓
                </button>
                <button
                  type="button"
                  title="Add code cell below"
                  onClick={() => addCellBelow(cell.id)}
                >
                  +
                </button>
                <button
                  type="button"
                  title="Delete cell"
                  className="danger"
                  onClick={() => deleteCell(cell.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </main>
      <footer className="footer">
        Runs entirely in your browser — nothing is uploaded to a server.
      </footer>
      <CMFloatAd />
    </div>
  );
}

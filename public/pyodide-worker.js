/**
 * pyodide-worker.js
 * Web worker that hosts the Pyodide (CPython on WebAssembly) runtime.
 * Kept as a classic worker in /public so importScripts() can pull Pyodide
 * from the CDN without any bundler involvement.
 *
 * Message protocol (worker <- main):
 *   { type: 'init', pyodideUrl }          - load the runtime
 *   { type: 'run',  id, code }            - execute one cell
 *
 * Message protocol (worker -> main):
 *   { type: 'ready' }                                   - runtime loaded
 *   { type: 'init-error', message }                     - runtime failed to load
 *   { type: 'stream', id, name, text }                  - stdout/stderr chunk
 *   { type: 'done', id, result, images, error }         - cell finished
 *
 * Licensed under CC BY-NC-SA 4.0.
 */

/* global loadPyodide, importScripts */

let pyodide = null;

/** Python helper installed at init: grabs any open matplotlib figures as base64 PNGs. */
const GRAB_FIGS_PY = `
import sys as _dj_sys

def _dj_grab_figs():
    """Return open matplotlib figures as base64 PNG strings, then close them."""
    if 'matplotlib' not in _dj_sys.modules:
        return []
    import matplotlib.pyplot as _plt
    import io as _io
    import base64 as _b64
    grabbed = []
    for num in _plt.get_fignums():
        buf = _io.BytesIO()
        _plt.figure(num).savefig(buf, format='png', bbox_inches='tight', dpi=110)
        grabbed.append(_b64.b64encode(buf.getvalue()).decode('ascii'))
    _plt.close('all')
    return grabbed
`;

/** Python setup run once: headless matplotlib and a clear input() error. */
const SETUP_PY = `
import os
os.environ['MPLBACKEND'] = 'AGG'

import builtins

def _dj_no_input(prompt=''):
    raise RuntimeError(
        "input() is not available in this notebook runner. "
        "Set your values in the code instead, e.g. name = 'Alex'"
    )

builtins.input = _dj_no_input
`;

/**
 * Load Pyodide and install the Python-side helpers.
 * @param {string} pyodideUrl Base CDN URL ending in a slash.
 */
async function init(pyodideUrl) {
  try {
    importScripts(pyodideUrl + 'pyodide.js');
    pyodide = await loadPyodide({ indexURL: pyodideUrl });
    pyodide.runPython(SETUP_PY);
    pyodide.runPython(GRAB_FIGS_PY);
    self.postMessage({ type: 'ready' });
  } catch (err) {
    self.postMessage({ type: 'init-error', message: String(err) });
  }
}

/**
 * Execute one cell of Python and report streams, figures and result.
 * @param {string} id   Cell id, echoed back so the UI can route output.
 * @param {string} code Python source to run.
 */
async function run(id, code) {
  const send = (name, text) => self.postMessage({ type: 'stream', id, name, text });
  pyodide.setStdout({ batched: (text) => send('stdout', text) });
  pyodide.setStderr({ batched: (text) => send('stderr', text) });

  let result = null;
  let error = null;
  let images = [];

  try {
    // Fetch any packages the cell imports (numpy, matplotlib, ...) from the CDN.
    await pyodide.loadPackagesFromImports(code);
    const value = await pyodide.runPythonAsync(code);
    if (value !== undefined) {
      // PyProxy values stringify via Python str(); primitives via String().
      result = String(value);
      if (value && typeof value.destroy === 'function') value.destroy();
    }
  } catch (err) {
    error = String(err.message || err);
  }

  try {
    const figs = pyodide.runPython('_dj_grab_figs()');
    images = figs.toJs();
    figs.destroy();
  } catch {
    images = [];
  }

  self.postMessage({ type: 'done', id, result, images, error });
}

self.onmessage = (event) => {
  const msg = event.data;
  if (msg.type === 'init') init(msg.pyodideUrl);
  else if (msg.type === 'run') run(msg.id, msg.code);
};

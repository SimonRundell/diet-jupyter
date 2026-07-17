/**
 * notebook.js
 * Parse and serialise Jupyter notebook (nbformat 4) files.
 * Licensed under CC BY-NC-SA 4.0.
 */

/**
 * A cell as held in app state.
 * @typedef {Object} AppCell
 * @property {string} id            Stable UI id.
 * @property {'code'|'markdown'|'raw'} cellType
 * @property {string} source        Full cell source as one string.
 * @property {Array<Object>} outputs Outputs in app shape (see below).
 * @property {number|null} execCount Execution counter shown as In [n].
 *
 * App output shapes:
 *   { kind: 'stream', name: 'stdout'|'stderr', text }
 *   { kind: 'image',  b64 }                       - PNG, base64
 *   { kind: 'result', text }                      - repr of last expression
 *   { kind: 'error',  text }                      - traceback / message
 */

/** Strip ANSI colour escape codes (Jupyter tracebacks are full of them). */
export function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Join nbformat source (string or array of lines) into a single string. */
function joinSource(source) {
  return Array.isArray(source) ? source.join('') : String(source ?? '');
}

/**
 * Convert one nbformat output object into app output shape(s).
 * @param {Object} out nbformat output.
 * @returns {Array<Object>} zero or more app outputs.
 */
function fromNbOutput(out) {
  switch (out.output_type) {
    case 'stream':
      return [{ kind: 'stream', name: out.name || 'stdout', text: joinSource(out.text) }];
    case 'error':
      return [{ kind: 'error', text: stripAnsi((out.traceback || []).join('\n')) }];
    case 'execute_result':
    case 'display_data': {
      const data = out.data || {};
      const results = [];
      if (data['image/png']) {
        results.push({ kind: 'image', b64: joinSource(data['image/png']).replace(/\n/g, '') });
      } else if (data['text/plain']) {
        results.push({ kind: 'result', text: joinSource(data['text/plain']) });
      }
      return results;
    }
    default:
      return [];
  }
}

/**
 * Parse a .ipynb JSON string into app state.
 * @param {string} jsonText Raw file contents.
 * @returns {{ metadata: Object, nbformat: number, nbformatMinor: number, cells: AppCell[] }}
 * @throws {Error} when the file is not a valid v4+ notebook.
 */
export function parseNotebook(jsonText) {
  const nb = JSON.parse(jsonText);
  if (!Array.isArray(nb.cells) || (nb.nbformat ?? 0) < 4) {
    throw new Error('Not a Jupyter notebook (nbformat 4) file');
  }
  const cells = nb.cells.map((cell) => ({
    id: crypto.randomUUID(),
    cellType: cell.cell_type,
    source: joinSource(cell.source),
    outputs: (cell.outputs || []).flatMap(fromNbOutput),
    execCount: cell.execution_count ?? null,
  }));
  return {
    metadata: nb.metadata || {},
    nbformat: nb.nbformat,
    nbformatMinor: nb.nbformat_minor ?? 5,
    cells,
  };
}

/** Split a source string into nbformat's line array (each line keeps its \n). */
function splitSource(source) {
  const lines = source.split('\n');
  return lines.map((line, i) => (i < lines.length - 1 ? line + '\n' : line)).filter(
    (line, i, arr) => !(i === arr.length - 1 && line === '')
  );
}

/** Convert one app output back to nbformat. */
function toNbOutput(out) {
  switch (out.kind) {
    case 'stream':
      return { output_type: 'stream', name: out.name, text: splitSource(out.text) };
    case 'image':
      return {
        output_type: 'display_data',
        data: { 'image/png': out.b64 },
        metadata: {},
      };
    case 'result':
      return {
        output_type: 'execute_result',
        execution_count: null,
        data: { 'text/plain': splitSource(out.text) },
        metadata: {},
      };
    case 'error':
      return {
        output_type: 'error',
        ename: 'Error',
        evalue: '',
        traceback: out.text.split('\n'),
      };
    default:
      return null;
  }
}

/**
 * Serialise app state back to a .ipynb JSON string.
 * @param {{ metadata: Object, nbformat: number, nbformatMinor: number, cells: AppCell[] }} state
 * @returns {string} pretty-printed notebook JSON.
 */
export function serialiseNotebook(state) {
  const cells = state.cells.map((cell) => {
    const nbCell = {
      cell_type: cell.cellType,
      metadata: {},
      source: splitSource(cell.source),
    };
    if (cell.cellType === 'code') {
      nbCell.execution_count = cell.execCount;
      nbCell.outputs = cell.outputs.map(toNbOutput).filter(Boolean);
    }
    return nbCell;
  });
  return JSON.stringify(
    {
      cells,
      metadata: state.metadata,
      nbformat: state.nbformat,
      nbformat_minor: state.nbformatMinor,
    },
    null,
    1
  );
}

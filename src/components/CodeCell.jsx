/**
 * CodeCell.jsx
 * Editable Python cell: CodeMirror editor, run button, execution counter
 * and rendered outputs. Shift+Enter runs the cell.
 * Licensed under CC BY-NC-SA 4.0.
 */

import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import OutputArea from './OutputArea';

const langExtensions = [python()];

/**
 * @param {Object} props
 * @param {import('../utils/notebook').AppCell} props.cell
 * @param {boolean} props.busy        True while this cell is executing.
 * @param {boolean} props.kernelReady True when the kernel can accept runs.
 * @param {(source: string) => void} props.onChange
 * @param {() => void} props.onRun
 */
export default function CodeCell({ cell, busy, kernelReady, onChange, onRun }) {
  const extensions = [
    Prec.highest(
      keymap.of([
        {
          key: 'Shift-Enter',
          run: () => {
            onRun();
            return true;
          },
        },
      ])
    ),
    ...langExtensions,
  ];

  return (
    <div className="code-cell">
      <div className="code-cell-gutter">
        <button
          type="button"
          className="run-button"
          title="Run cell (Shift+Enter)"
          disabled={!kernelReady}
          onClick={onRun}
        >
          {busy ? '◐' : '▶'}
        </button>
        <span className="exec-count">
          {busy ? 'In [*]' : `In [${cell.execCount ?? ' '}]`}
        </span>
      </div>
      <div className="code-cell-body">
        <CodeMirror
          value={cell.source}
          extensions={extensions}
          onChange={onChange}
          basicSetup={{ lineNumbers: true, foldGutter: false }}
        />
        <OutputArea outputs={cell.outputs} />
      </div>
    </div>
  );
}

/**
 * OutputArea.jsx
 * Renders the outputs of a code cell: streams, images, results, errors.
 * Licensed under CC BY-NC-SA 4.0.
 */

/**
 * @param {{ outputs: Array<Object> }} props Outputs in app shape (see notebook.js).
 */
export default function OutputArea({ outputs }) {
  if (!outputs || outputs.length === 0) return null;
  return (
    <div className="output-area">
      {outputs.map((out, i) => {
        switch (out.kind) {
          case 'stream':
            return (
              <pre key={i} className={`output-stream output-${out.name}`}>
                {out.text}
              </pre>
            );
          case 'image':
            return (
              <img
                key={i}
                className="output-image"
                src={`data:image/png;base64,${out.b64}`}
                alt="Cell plot output"
              />
            );
          case 'result':
            return (
              <pre key={i} className="output-result">
                {out.text}
              </pre>
            );
          case 'error':
            return (
              <pre key={i} className="output-error">
                {out.text}
              </pre>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

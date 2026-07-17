# Diet Jupyter

A minimal, fully client-side runner for Jupyter notebooks, built for the
classroom. Students upload a `.ipynb` file, read the instructions, edit and
run the Python code cells, and download their modified copy. Nothing is
stored on a server; all Python runs in the browser via
[Pyodide](https://pyodide.org/) (CPython compiled to WebAssembly).

## Features

- Upload or drag-drop any nbformat 4 `.ipynb` file
- Markdown cells render as read-only instructions
- Code cells are editable (CodeMirror with Python highlighting)
- Run a single cell (button or Shift+Enter) or Run All
- Packages such as numpy and matplotlib are fetched automatically from the
  Pyodide CDN when a cell imports them; matplotlib figures render as images
- Add, delete and reorder cells
- Restart kernel button recovers from infinite loops
- Download the current notebook state as a `.ipynb`
- Deploys as static files: no PHP, no database, no server-side compute

## Development

```
npm install
npm run dev
```

## Configuration

`public/.config.json`:

| Key              | Purpose                                        |
| ---------------- | ---------------------------------------------- |
| `appTitle`       | Name shown in the toolbar                      |
| `pyodideUrl`     | Base CDN URL for the Pyodide distribution      |
| `sampleNotebook` | Path (under public/) of the sample notebook    |

## Deployment

```
npm run build
```

Upload the contents of `dist/` to any static host. An internet connection is
still required at runtime for the first Pyodide download (about 10 MB,
cached by the browser afterwards).

## Known limits

- `input()` is not supported; cells raise a clear error suggesting students
  set values in code instead
- Stopping a running cell means restarting the kernel (variables are lost)
- No server-side saving by design; students download their work each lesson

## License

Creative Commons BY-NC-SA 4.0 — see [LICENSE](LICENSE).

/**
 * MarkdownCell.jsx
 * Renders a markdown cell as read-only instructions.
 * Licensed under CC BY-NC-SA 4.0.
 */

import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * @param {{ source: string }} props Markdown source text.
 */
export default function MarkdownCell({ source }) {
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(source, { async: false })),
    [source]
  );
  return (
    <div
      className="markdown-cell"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

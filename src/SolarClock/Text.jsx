import { Fragment } from 'react';

// Renders a text from content.js: fills {placeholders} and turns **words** bold.
// Placeholder values can be strings, numbers or React elements.
const PATTERN = /(\*\*[^*]+\*\*|\{\w+\})/g;

export default function Text({ children, vars = {} }) {
  const parts = String(children).split(PATTERN);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}><Text vars={vars}>{part.slice(2, -2)}</Text></strong>;
        }
        const token = part.match(/^\{(\w+)\}$/);
        if (token) {
          const value = vars[token[1]];
          return <Fragment key={i}>{value === undefined ? part : value}</Fragment>;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

// Same idea for places that need a plain string (aria-labels and the like).
export function plain(str, vars = {}) {
  return String(str)
    .replace(/\*\*/g, '')
    .replace(/\{(\w+)\}/g, (match, key) => (vars[key] === undefined ? match : vars[key]));
}

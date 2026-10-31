import * as React from 'react';

const TOKEN_REGEX = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function unescapeAngles(value: string): string {
  return value.replace(/\\</g, '<').replace(/\\>/g, '>');
}

/** Renders the small subset of markdown used in Help & Support copy (**bold**, `code`) as styled text. */
export function HelpRichText({ text }: { text: string }) {
  const parts = text.split(TOKEN_REGEX).filter((part) => part.length > 0);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={index} className="text-foreground font-semibold">
              {unescapeAngles(part.slice(2, -2))}
            </strong>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={index}
              className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-[0.85em]"
            >
              {unescapeAngles(part.slice(1, -1))}
            </code>
          );
        }
        return <React.Fragment key={index}>{unescapeAngles(part)}</React.Fragment>;
      })}
    </>
  );
}

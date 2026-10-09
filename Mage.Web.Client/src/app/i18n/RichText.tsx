import { Fragment, type ReactNode } from 'react';

/**
 * A translated sentence with elements inside it: `{name}` placeholders left in the text by `t` are replaced by
 * `parts.name` (a link, a key cap), so each language places them where its word order needs them.
 */
export function RichText({ text, parts }: { text: string; parts: Record<string, ReactNode> }) {
  return (
    <>
      {text.split(/(\{\w+\})/).map((piece, index) => {
        const name = /^\{(\w+)\}$/.exec(piece)?.[1];
        return <Fragment key={index}>{name !== undefined && name in parts ? parts[name] : piece}</Fragment>;
      })}
    </>
  );
}

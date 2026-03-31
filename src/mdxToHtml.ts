import { evaluate } from '@mdx-js/mdx';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as runtime from 'react/jsx-runtime';
import * as Book from './book-components';

const bookComponents = {
  BookRoot: Book.BookRoot,
  Chapter: Book.Chapter,
  Section: Book.Section,
  ChapterTitle: Book.ChapterTitle,
  PartDivider: Book.PartDivider,
  Callout: Book.Callout,
  Blockquote: Book.Blockquote,
  Figure: Book.Figure,
  CodeBlock: Book.CodeBlock,
  BookMeta: Book.BookMeta,
};

/**
 * Compile MDX source to HTML using book-components as the component map.
 * Used by repub epub when processing .mdx files.
 */
export async function mdxToHtml(mdxSource: string, filePath?: string): Promise<string> {
  const file = filePath ? { path: filePath, value: mdxSource } : mdxSource;
  const { default: MDXContent } = await evaluate(file, {
    ...runtime,
    baseUrl: import.meta.url,
    useMDXComponents: () => bookComponents,
  });
  return renderToStaticMarkup(
    React.createElement(MDXContent as React.ComponentType<{ components?: typeof bookComponents }>, {
      components: bookComponents,
    })
  );
}

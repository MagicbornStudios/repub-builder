import React from 'react';
import type { ReaderLinkComponent, ReaderLinkProps } from './types';

export const defaultReaderLink: ReaderLinkComponent = function DefaultReaderLink({
  href,
  children,
  ...rest
}: ReaderLinkProps) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
};

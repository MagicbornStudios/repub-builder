import { describe, expect, it } from 'vitest';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

describe('reader UI primitives (EpubViewer chrome stack)', () => {
  it('exports Button, Input, and Textarea', () => {
    expect(typeof Button).toBe('function');
    expect(typeof Input).toBe('function');
    expect(typeof Textarea).toBe('function');
  });
});

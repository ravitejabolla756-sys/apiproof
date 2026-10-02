import { describe, expect, it } from 'vitest';
import { add } from './index.js';

describe('minimal verification fixture', () => {
  it('executes a real test', () => {
    expect(add(2, 3)).toBe(5);
  });
});

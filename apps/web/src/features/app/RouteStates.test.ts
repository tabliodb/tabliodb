import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './RouteStates';

describe(getErrorMessage.name, () => {
  it('turns bare HTTP status errors into user-facing messages', () => {
    expect(getErrorMessage(new Error('Error: 404'))).toBe(
      'The requested data was not found. It may have been deleted or moved.',
    );
  });

  it('keeps useful application errors intact', () => {
    expect(getErrorMessage(new Error('Project name is required'))).toBe('Project name is required');
  });
});

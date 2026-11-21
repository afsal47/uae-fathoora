import { GenericAspAdapter } from './generic-asp.adapter';
import { EvatraAdapter } from './providers/evatra/evatra.adapter';

/**
 * Legacy GenericAspAdapter tests moved to providers/evatra/evatra.adapter.spec.ts.
 */
describe('GenericAspAdapter (legacy alias)', () => {
  it('re-exports EvatraAdapter', () => {
    expect(GenericAspAdapter).toBe(EvatraAdapter);
  });
});

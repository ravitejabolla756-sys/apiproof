/** Safe errors carry fixed messages; raw parser errors may contain customer code. */
export class AnalysisError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AnalysisError';
  }
}

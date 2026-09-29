/** An error that carries the HTTP status to answer with. Kept dependency-free so pure modules can use it. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

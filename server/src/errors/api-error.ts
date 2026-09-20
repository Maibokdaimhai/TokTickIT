export type ErrorBody = {
  code: string;
  message: string;
  details?: string[];
};

/** An expected application failure, translated to HTTP only at the boundary. */
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly error: ErrorBody, options?: ErrorOptions) {
    super(error.message, options);
    this.name = "ApiError";
  }
}

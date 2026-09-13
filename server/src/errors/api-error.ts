export type ErrorBody = {
  code: string;
  message: string;
  details?: string[];
};

/** An expected application failure, translated to HTTP only at the boundary. */
export class ApiError extends Error {
  constructor(public readonly status: number, public readonly error: ErrorBody) {
    super(error.message);
    this.name = "ApiError";
  }
}

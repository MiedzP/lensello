/**
 * Result type utilities for consistent error handling
 * Replaces the need for manual discriminated union checking
 */

/**
 * Success result type
 */
export type Ok<T> = { ok: true; data: T };

/**
 * Error result type
 */
export type Err<E> = { ok: false; error: E };

/**
 * Result is either Ok or Err
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Create a success result
 */
export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

/**
 * Create an error result
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Type guard to check if result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * Type guard to check if result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

/**
 * Map over a result's success value
 */
export function mapOk<T, E, U>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.data));
  }
  return result;
}

/**
 * Map over a result's error value
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Get the data from a result or throw
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.data;
  }
  throw new Error(`Result unwrap failed: ${JSON.stringify(result.error)}`);
}

/**
 * Get the data from a result or a default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Chain multiple results
 */
export async function chain<T1, E, T2>(
  result: Result<T1, E>,
  fn: (data: T1) => Promise<Result<T2, E>>
): Promise<Result<T2, E>> {
  if (isErr(result)) {
    return result;
  }
  return fn(result.data);
}

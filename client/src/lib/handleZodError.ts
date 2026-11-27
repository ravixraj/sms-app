import { z, type ZodSafeParseResult } from "zod";

export function handleZodError<T>(result: ZodSafeParseResult<T>): T {
  if (result.success) return result.data;

  throw new Error(z.prettifyError(result.error));
}

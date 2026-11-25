import { HTTPStatus } from "#const";
import { zValidator as validate } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { HTTPException } from "hono/http-exception";
import { type ZodType } from "zod";

export const zValidator = <
  Schema extends ZodType,
  Target extends keyof ValidationTargets,
>(
  target: Target,
  schema: Schema,
) =>
  validate(target, schema, (result) => {
    if (!result.success) {
      throw new HTTPException(HTTPStatus.UNPROCESSABLE_ENTITY, {
        message: "One or more fields are invalid.",
        cause: result.error.issues.map(({ path, message }) => ({
          path: path.join(".") || null,
          message,
        })),
      });
    }
  });

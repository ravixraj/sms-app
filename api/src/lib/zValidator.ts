import { zValidator as zv } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";
import { HTTP } from "./http";
import { type ContentfulStatusCode } from "hono/utils/http-status";

export const zValidator = <
  T extends ZodType,
  Target extends keyof ValidationTargets,
>(
  target: Target,
  schema: T,
) =>
  zv(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error?.issues[0];
      const path = issue?.path.join(".");
      const isMissing =
        issue?.code === "invalid_type" && issue.input === undefined;

      const message = isMissing
        ? path
          ? `Missing '${path}' field`
          : "Missing required fields"
        : issue?.message || "Invalid input data";

      const statusCode = (isMissing ? 400 : 422) as ContentfulStatusCode;
      return c.json(HTTP.Response(message, null, false), statusCode);
    }
  });

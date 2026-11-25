import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

export const bodyLimitMw = (maxSize: number) =>
  bodyLimit({
    maxSize,
    onError: () => {
      throw new HTTPException(413, {
        message: `Request body exceeds the ${Math.ceil(maxSize / 1024)} KB limit`,
      });
    },
  });

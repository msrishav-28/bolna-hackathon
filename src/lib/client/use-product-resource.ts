"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ApiError } from "./api";
import { productRequest } from "./product-api";

export function useProductResource<T>(
  path: string | null,
  schema: z.ZodType<T>,
  poll = 0,
  shouldPoll?: (data: T) => boolean,
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    data: T | null;
    error: ApiError | null;
    loading: boolean;
    path: string | null;
  }>({ data: null, error: null, loading: true, path: null });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let transientFailures = 0;
    const load = async () => {
      try {
        const data = await productRequest(path, schema, {
          signal: controller.signal,
        });
        transientFailures = 0;
        if (!controller.signal.aborted)
          setState({ data, error: null, loading: false, path });
        if (
          poll &&
          !controller.signal.aborted &&
          (!shouldPoll || shouldPoll(data))
        )
          timer = setTimeout(load, poll);
      } catch (error) {
        const transient =
          error instanceof ApiError &&
          (error.code === "NETWORK" ||
            [500, 502, 503, 504].includes(error.status ?? 0));
        if (
          poll &&
          transient &&
          !controller.signal.aborted &&
          transientFailures++ < 2
        ) {
          // Retry read-only status polling; never reserve or start another voice run.
          timer = setTimeout(load, poll);
          return;
        }
        if (!controller.signal.aborted)
          setState((previous) => ({
            data: previous.path === path ? previous.data : null,
            path,
            loading: false,
            error:
              error instanceof ApiError
                ? error
                : new ApiError(
                    "Please check your connection and try again.",
                    "NETWORK",
                  ),
          }));
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [path, schema, attempt, poll, shouldPoll]);
  return {
    ...(state.path === path
      ? state
      : { data: null, error: null, loading: true }),
    retry: () => {
      setState({ data: null, error: null, loading: true, path });
      setAttempt((n) => n + 1);
    },
  };
}

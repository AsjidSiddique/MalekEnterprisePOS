"use client";

import { useCallback, useState } from "react";
import type { z } from "zod";

/**
 * Minimal Zod-backed form state. Values are kept as plain strings/booleans (what inputs produce)
 * and validated/coerced by the schema on submit.
 */
export function useForm<TValues extends Record<string, unknown>, TOut>(schema: z.ZodType<TOut, z.ZodTypeDef, unknown>, initial: TValues) {
  const [values, setValues] = useState<TValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = useCallback(<K extends keyof TValues>(key: K, value: TValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key as string] ? { ...prev, [key as string]: "" } : prev));
  }, []);

  const validate = useCallback((): TOut | null => {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return result.data;
    }
    const next: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!next[key]) next[key] = issue.message;
    }
    setErrors(next);
    return null;
  }, [schema, values]);

  return { values, set, setValues, errors, validate };
}

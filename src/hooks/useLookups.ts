"use client";

import { useMemo } from "react";
import type { Customer } from "@/types";
import { listCustomers } from "@/services/customerService";
import { useAsyncData } from "./useAsyncData";

/** Loads customers once and exposes an id → customer map so list pages can show names instead of ids. */
export function useCustomers() {
  const state = useAsyncData(listCustomers, []);
  const map = useMemo(() => new Map<string, Customer>((state.data ?? []).map((c) => [c.id, c])), [state.data]);
  const name = (id: string) => map.get(id)?.businessName ?? "Unknown customer";
  return { ...state, customers: state.data ?? [], map, name };
}

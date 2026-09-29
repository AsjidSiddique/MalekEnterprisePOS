"use client";

import { useParams } from "next/navigation";
import { CustomerDetail } from "@/components/admin/CustomerDetail";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <CustomerDetail id={id} />;
}

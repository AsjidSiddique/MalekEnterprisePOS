"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatZAR } from "@/lib/utils";

const AXIS = { fontSize: 12, fill: "#5B6680" };
const tip = { borderRadius: 12, border: "1px solid #DBE2F0", fontSize: 12, boxShadow: "0 12px 30px -12px rgba(12,26,61,.3)" };

/** Revenue area chart. `dark` is for use on the navy hero card. */
export function RevenueArea({ data, dark = false, height = 220 }: { data: { label: string; value: number }[]; dark?: boolean; height?: number }) {
  const stroke = dark ? "#FFC72C" : "#1E3A7A";
  const grid = dark ? "rgba(255,255,255,0.09)" : "#E6EAF3";
  const text = dark ? "#AAB6D2" : "#5B6680";
  const id = dark ? "rev-dark" : "rev-light";
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={stroke} stopOpacity={dark ? 0.45 : 0.28} /><stop offset="1" stopColor={stroke} stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ ...AXIS, fill: text }} />
          <YAxis tickLine={false} axisLine={false} tick={{ ...AXIS, fill: text }} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
          <Tooltip contentStyle={tip} cursor={{ stroke, strokeOpacity: 0.3 }} formatter={(v: number) => [formatZAR(v), "Received"]} />
          <Area type="monotone" dataKey="value" stroke={stroke} strokeWidth={2.75} fill={`url(#${id})`} dot={false} activeDot={{ r: 5, fill: stroke, stroke: dark ? "#0C1A3D" : "#fff", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthBars({ data, money = false, color = "#0C1A3D", height = 220 }: { data: { label: string; value: number }[]; money?: boolean; color?: string; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#E6EAF3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} tick={AXIS} allowDecimals={false} tickFormatter={(v: number) => (money && v >= 1000 ? `${v / 1000}k` : String(v))} />
          <Tooltip contentStyle={tip} cursor={{ fill: "rgba(12,26,61,0.05)" }} formatter={(v: number) => [money ? formatZAR(v) : v, money ? "Received" : "Count"]} />
          <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

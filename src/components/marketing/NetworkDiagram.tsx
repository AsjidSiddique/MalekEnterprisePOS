"use client";

import { useReducedMotion } from "framer-motion";

const tills = [60, 130, 200];

/** How data flows: tills talk to the shop server on the local network; only licence checks leave the building. */
export function NetworkDiagram() {
  const reduce = useReducedMotion();
  const dot = (path: string, dur: string, begin = "0s", cls = "fill-accent") =>
    reduce ? null : (
      <circle r="3.5" className={cls}>
        <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={path} />
      </circle>
    );

  return (
    <svg viewBox="0 0 760 300" role="img" aria-label="Diagram: several tills connect to one shop server on the local network. The server occasionally contacts the licence service over the internet." className="h-auto w-full">
      <rect x="10" y="10" width="470" height="280" rx="16" className="fill-white/[0.05] stroke-white/20" strokeDasharray="4 6" />
      <text x="28" y="36" className="fill-ink-300 text-[13px]">Your shop, local network</text>

      {tills.map((y, i) => {
        const path = `M150 ${y + 24} C 230 ${y + 24}, 240 150, 300 150`;
        return (
          <g key={y}>
            <rect x="34" y={y} width="116" height="48" rx="8" className="fill-ink-800 stroke-white/20" />
            <text x="92" y={y + 29} textAnchor="middle" className="fill-white text-[14px] font-semibold">Till {i + 1}</text>
            <path d={path} className="fill-none stroke-ink-400" strokeWidth="1.5" />
            {dot(path, `${2.4 + i * 0.4}s`, `${i * 0.5}s`)}
          </g>
        );
      })}

      <rect x="300" y="108" width="150" height="84" rx="10" className="fill-ink-700 stroke-accent" strokeWidth="2" />
      <text x="375" y="145" textAnchor="middle" className="fill-white text-[15px] font-semibold">Shop server</text>
      <text x="375" y="167" textAnchor="middle" className="fill-ink-200 text-[12px]">PostgreSQL database</text>

      <path d="M450 150 H 600" className="fill-none stroke-ink-400" strokeWidth="1.5" strokeDasharray="5 6" />
      {dot("M450 150 H 600", "4s", "0s", "fill-white")}

      <g>
        <rect x="600" y="108" width="140" height="84" rx="10" className="fill-ink-800 stroke-white/20" />
        <text x="670" y="145" textAnchor="middle" className="fill-white text-[15px] font-semibold">Licence service</text>
        <text x="670" y="167" textAnchor="middle" className="fill-ink-200 text-[12px]">Online, checked daily</text>
      </g>
      <text x="525" y="132" textAnchor="middle" className="fill-ink-300 text-[12px]">licence check only</text>
    </svg>
  );
}

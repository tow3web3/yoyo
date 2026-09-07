// Minimal stroked line icons (1.6px, currentColor). Size via className.
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' };

export const Coins = (p) => (
  <svg {...base} {...p}><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" /><path d="M9 15v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.5-2-2.7-4.7-2.95" /></svg>
);
export const Swap = (p) => (<svg {...base} {...p}><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" /></svg>);
export const Gift = (p) => (
  <svg {...base} {...p}><path d="M4 11h16v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M3 7h18v4H3zM12 7v13M12 7S10.5 3 8 3 5 6 7 7M12 7s1.5-4 4-4 3 3 1 4" /></svg>
);
export const Target = (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.5" /></svg>);
export const Clock = (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2.5" /></svg>);
export const Lock = (p) => (<svg {...base} {...p}><rect x="4.5" y="10" width="15" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>);
export const Chart = (p) => (<svg {...base} {...p}><path d="M4 4v16h16" /><path d="M8 14l3-3 3 2 4-5" /></svg>);
export const Arrow = (p) => (<svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const Bolt = (p) => (<svg {...base} {...p}><path d="M13 3 5 13h6l-1 8 8-10h-6z" /></svg>);
export const Shield = (p) => (<svg {...base} {...p}><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>);
export const Users = (p) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17 13.6A5.5 5.5 0 0 1 20.5 19" /></svg>
);
export const Pause = (p) => (<svg {...base} {...p}><rect x="7" y="5" width="3.5" height="14" rx="1" /><rect x="13.5" y="5" width="3.5" height="14" rx="1" /></svg>);
export const Flame = (p) => (
  <svg {...base} {...p}><path d="M12 3c1 3-1 4.5-2.5 6.5C8 11.5 7 13 7 15a5 5 0 0 0 10 0c0-2.2-1.2-4.2-3-6 .3 1.6-.4 2.6-1.3 3C12 11 11 9 12 3z" /></svg>
);
export const Bell = (p) => (<svg {...base} {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>);
export const TrendUp = (p) => (<svg {...base} {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>);
export const Dice = (p) => (
  <svg {...base} {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="15" r="1" fill="currentColor" /><circle cx="15" cy="9" r="1" fill="currentColor" /><circle cx="9" cy="15" r="1" fill="currentColor" /></svg>
);
export const Layers = (p) => (<svg {...base} {...p}><path d="M12 4 3 9l9 5 9-5z" /><path d="M3 14l9 5 9-5" /></svg>);
export const Vote = (p) => (<svg {...base} {...p}><path d="M5 11h14v9H5z" /><path d="M8 11V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v5" /><path d="M10 8l1.5 1.5L15 6" /></svg>);
export const Scale = (p) => (<svg {...base} {...p}><path d="M12 4v16M4 20h16" /><path d="M6 8l-3 6h6zM18 8l-3 6h6z" /><path d="M6 8h12" /></svg>);
export const Wallet = (p) => (<svg {...base} {...p}><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M16 12h4v3h-4z" /><path d="M3 9V6a1 1 0 0 1 1-1h12" /></svg>);
export const Medal = (p) => (<svg {...base} {...p}><circle cx="12" cy="14" r="6" /><path d="M9 8.5 6 3h4l2 3.5L14 3h4l-3 5.5" /><path d="M12 11.5v3l1.8 1" /></svg>);
export const Check = (p) => (<svg {...base} {...p}><path d="M5 12l4 4 10-10" /></svg>);
export const Copy = (p) => (<svg {...base} {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>);

export const X = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
);
export const Github = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.37-1.34-1.74-1.34-1.74-1.09-.73.08-.72.08-.72 1.21.08 1.84 1.22 1.84 1.22 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.57-2.67-.3-5.47-1.31-5.47-5.84 0-1.29.47-2.34 1.24-3.17-.13-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.21a11.6 11.6 0 0 1 3-.39c1.02 0 2.05.13 3 .39 2.28-1.53 3.29-1.21 3.29-1.21.66 1.64.25 2.86.12 3.16.77.83 1.24 1.88 1.24 3.17 0 4.54-2.81 5.53-5.49 5.83.43.36.81 1.08.81 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.83.56A12.02 12.02 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" /></svg>
);

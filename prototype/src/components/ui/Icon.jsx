// Minimal 1.5px-stroke icon set, drawn on a 20-unit grid to sit on the
// same optical baseline as 14–16px interface text.
const PATHS = {
  chevronDown: "M5 7.5l5 5 5-5",
  chevronRight: "M7.5 5l5 5-5 5",
  arrowRight: "M4 10h12M11 5l5 5-5 5",
  arrowUpRight: "M6 14L14 6M7 6h7v7",
  external: "M11 4h5v5M16 4l-7 7M14 12v3.5a.5.5 0 01-.5.5h-9a.5.5 0 01-.5-.5v-9a.5.5 0 01.5-.5H8",
  close: "M5 5l10 10M15 5L5 15",
  menu: "M3 6.5h14M3 10h14M3 13.5h14",
  search: "M9 15a6 6 0 100-12 6 6 0 000 12zM13.5 13.5L17 17",
  info: "M10 17.5a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM10 9v4.5M10 6.6v.1",
  download: "M10 3.5v9M6 9l4 4 4-4M4 16.5h12",
  check: "M4.5 10.5l3.5 3.5 7.5-8",
  locate: "M10 17.5a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  compare: "M7 4v12M13 4v12M3 8l4-4 4 4M9 12l4 4 4-4",
  table: "M3 4.5h14v11H3zM3 8.5h14M3 12h14M8 4.5v11",
  chart: "M3.5 16.5h13M6 13.5V9M10 13.5V5.5M14 13.5v-6",
  mail: "M3 5h14v10H3zM3 5.5l7 5.5 7-5.5",
  file: "M5 2.5h6.5L15 6v11.5H5zM11 2.5V6h4",
  sparkle: "M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z",
  globe: "M10 17.5a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM2.5 10h15M10 2.5c2 2.2 3 4.7 3 7.5s-1 5.3-3 7.5c-2-2.2-3-4.7-3-7.5s1-5.3 3-7.5z",
  layers: "M10 3l7.5 4-7.5 4-7.5-4zM2.5 11l7.5 4 7.5-4",
};

export default function Icon({ name, size = 18, className, title, strokeWidth = 1.5 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}

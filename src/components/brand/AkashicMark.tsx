export function AkashicMark({
  size = 22,
  className,
  color = "currentColor",
}: {
  size?: number;
  className?: string;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      aria-hidden="true"
      className={className}
      style={{ color }}
    >
      <circle
        cx="11"
        cy="11"
        r="8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.3"
      />
      <ellipse
        cx="11"
        cy="11"
        rx="8.5"
        ry="3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        transform="rotate(-24 11 11)"
      />
      <circle cx="11" cy="11" r="2" fill="currentColor" />
      <circle cx="18.2" cy="7.2" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 28 24"
      width={size}
      height={(size * 24) / 28}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="#6a2fd6">
        <circle cx="3" cy="3" r="1.8" />
        <circle cx="7.4" cy="7.4" r="1.8" />
        <circle cx="11.8" cy="11.8" r="1.8" />
        <circle cx="7.4" cy="16.2" r="1.8" />
        <circle cx="3" cy="20.6" r="1.8" />
      </g>
      <g fill="#e8307a">
        <circle cx="16.2" cy="20.6" r="1.8" />
        <circle cx="20.6" cy="20.6" r="1.8" />
        <circle cx="25" cy="20.6" r="1.8" />
      </g>
    </svg>
  );
}

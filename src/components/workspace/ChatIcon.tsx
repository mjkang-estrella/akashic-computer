export function ChatIcon({
  name,
}: {
  name:
    | "sidebar"
    | "new"
    | "search"
    | "send"
    | "stop"
    | "settings"
    | "copy"
    | "check"
    | "close"
    | "down"
    | "info";
}) {
  const paths = {
    sidebar: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
      </>
    ),
    new: (
      <>
        <path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7M15 3l6 6M9 15l-1 4 4-1L22 8a2 2 0 0 0-6-6Z" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    send: <path d="M12 20V4m-7 7 7-7 7 7" />,
    stop: (
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
    ),
    settings: (
      <>
        <path d="M3 7h5m4 0h9M3 17h9m4 0h5" />
        <circle cx="10" cy="7" r="2" />
        <circle cx="14" cy="17" r="2" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    down: <path d="m6 9 6 6 6-6" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7v.5" />
      </>
    ),
  };
  return (
    <svg
      className="ac-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

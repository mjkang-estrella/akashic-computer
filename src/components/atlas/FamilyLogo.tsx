import Image from "next/image";
import { FAMILY_LOGOS } from "@/lib/atlas/brands";

export function FamilyLogo({
  familyId,
  familyName,
  size = 30,
}: {
  familyId: string;
  familyName: string;
  size?: number;
}) {
  const logo = FAMILY_LOGOS[familyId];

  if (logo) {
    return (
      <Image
        src={logo}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="flex-none object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = familyName
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      className="flex flex-none items-center justify-center rounded-[6px] border border-line bg-panel2 font-display font-semibold text-muted"
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.32)) }}
    >
      {initials}
    </span>
  );
}

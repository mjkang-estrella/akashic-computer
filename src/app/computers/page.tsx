import { Suspense } from "react";
import { CloudWorkspace } from "@/components/workspace/CloudWorkspace";
export const metadata = { title: "Computers · Akashic Computer" };
export default function Page() {
  return (
    <Suspense fallback={<p>Loading workspace…</p>}>
      <CloudWorkspace view="computers" />
    </Suspense>
  );
}

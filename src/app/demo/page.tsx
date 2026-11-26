import { StudioWorkspace } from "@/components/studio/studio-workspace";
import { listWorkflows } from "@/db/repository";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const workflows = await listWorkflows();

  return <StudioWorkspace initialWorkflows={workflows} autoRunDemo />;
}

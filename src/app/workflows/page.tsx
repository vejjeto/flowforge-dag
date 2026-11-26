import { WorkflowsManager } from "@/components/workflows/workflows-manager";
import { listWorkflows } from "@/db/repository";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const workflows = await listWorkflows();
  return <WorkflowsManager initialWorkflows={workflows} />;
}

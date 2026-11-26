# FlowForge DAG — Editor Visual de Flujos y Servidor MCP

[![CI](https://github.com/vejjeto/flowforge-dag/actions/workflows/ci.yml/badge.svg)](https://github.com/vejjeto/flowforge-dag/actions/workflows/ci.yml)

**FlowForge DAG** es un estudio visual **standalone** para construir y ejecutar flujos de automatización sobre **Grafos Dirigidos Acíclicos (DAG)** con React Flow (`@xyflow/react`), ejecución paralela por niveles topológicos de Kahn, *checkpointing* y re-ejecución desde nodo fallido, nodos HTTP protegidos contra SSRF y un servidor **Model Context Protocol (MCP)** integrado (`POST /api/mcp` + stdio).

## Qué hace este proyecto

**FlowForge DAG** es un editor visual de flujos de automatización (estilo n8n) donde conectas nodos de *Trigger*, *Condición*, *Transformación*, *HTTP* o *IA* para ejecutar procesos paso a paso y en paralelo. Guarda el estado de cada nodo ejecutado para poder reanudar un flujo desde el punto exacto donde falló sin repetir todo desde cero, y expone herramientas MCP para que agentes de IA puedan validar y ejecutar flujos.

- **Estudio en vivo**: `/`
- **Demo interactiva en 1 clic**: `/demo`
- **Flujos e historial de ejecuciones**: `/workflows`
- **Documentación OpenAPI 3.1**: `/api/docs`

---

## Arquitectura

```mermaid
flowchart LR
  UI["Estudio React Flow + Inspector MCP (/ , /demo)"] -->|SSE / REST| API["Next.js App Router API (/api/workflows, /api/runs)"]
  Agent["Agente IA / IDE externo"] -->|JSON-RPC 2.0| MCP["Servidor MCP (/api/mcp y stdio)"]
  API --> Engine["Ejecutor Paralelo por Niveles Kahn + Checkpoint Replay"]
  MCP --> Engine
  Engine --> Nodes["Nodos: Trigger, Condition (AST), Transform, HTTP (Anti-SSRF), AI Summary, Log"]
  Engine --> DB["Drizzle ORM + SQLite (node:sqlite) / Postgres 17"]
```

---

## Decisiones Técnicas Clave (ADRs)

1. **Niveles topológicos paralelos con Kahn + `Promise.allSettled`**: Agrupar nodos con grado de entrada cero por oleadas (`computeTopologicalLevels`) permite ejecutar ramas independientes en paralelo preservando determinismo, salto condicional `true`/`false` y aislamiento de ciclos con Tarjan SCC.
2. **Persistencia de checkpoints y replay parcial**: Cada nodo guarda `inputJson` y `outputJson` en `node_execution_logs`. `POST /api/runs/[runId]/replay-from/[nodeId]` reutiliza los checkpoints exitosos previos y solo re-ejecuta desde el nodo objetivo hacia adelante.
3. **Servidor MCP dual (`POST /api/mcp` + stdio)**: Expone `list_workflows`, `validate_dag`, `run_workflow` y `get_run_logs` mediante un único despachador JSON-RPC 2.0 validado con Zod, compartido entre HTTP y CLI stdio.

---

## Ejecución Local en 3 Pasos

```bash
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Abre `http://localhost:3006` (o `http://localhost:3006/demo` para ejecutar un flujo en 1 clic).

---

## Trade-offs Honestos (100 → 100k Ejecuciones)

1. **SQLite local vs. PostgreSQL 17**: SQLite `node:sqlite` en modo WAL brinda latencia cero en desarrollo y pruebas; flujos concurrentes distribuidos deben apuntar Drizzle a PostgreSQL (`docker-compose.yml` + `src/db/schema.pg.ts`).
2. **Ejecución en proceso vs. workers distribuidos**: Correr oleadas `Promise.allSettled` dentro del Route Handler simplifica SSE en tiempo real; nodos HTTP lentos a escala de 100k ejecuciones requieren colas dedicadas (BullMQ/Temporal) con reintentos por nodo.
3. **Fallback heurístico local de `AiSummaryNode`**: Garantiza demos offline deterministas cuando faltan `OPENAI_API_KEY`/`GEMINI_API_KEY`, mientras en producción puede activarse cualquier proveedor LLM con salida estructurada Zod.

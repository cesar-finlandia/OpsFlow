export function installFakeModelContext(): { tools: Map<string, unknown>; calls: unknown[] } {
  const tools = new Map<string, unknown>();
  const calls: unknown[] = [];
  const fake = {
    registerTool: async (def: { name: string; description: string; inputSchema: unknown; annotations: unknown; execute: unknown }) => {
      if (tools.has(def.name)) throw new Error(`Tool ${def.name} already registered`);
      tools.set(def.name, def);
      calls.push({ type: "register", name: def.name });
    },
    executeTool: async (name: string, args: unknown) => {
      const def = tools.get(name) as { execute: (i: unknown, o?: unknown) => Promise<unknown> } | undefined;
      if (!def) throw new Error(`Tool not found: ${name}`);
      return def.execute(args, {});
    },
    getTools: () => Array.from(tools.values())
  };
  (globalThis as unknown as Record<string, unknown>)["document"] = { modelContext: fake };
  (globalThis as unknown as Record<string, unknown>)["originAgentCluster"] = true;
  return { tools, calls };
}
export function clearFakeModelContext(): void {
  try { delete (globalThis as unknown as Record<string, unknown>)["document"]; } catch {}
  try { delete (globalThis as unknown as Record<string, unknown>)["originAgentCluster"]; } catch {}
}

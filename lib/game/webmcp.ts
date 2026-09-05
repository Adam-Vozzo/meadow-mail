import type { MeadowEngine } from './engine';
import { costs, type Upgrade } from './state';
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
};
type ModelContext = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerGameTools(engine: MeadowEngine) {
  const context = (document as Document & { modelContext?: ModelContext })
    .modelContext;
  const lifecycle = new AbortController();
  if (!context?.registerTool) return () => {};
  const tools: Tool[] = [
    {
      name: 'read_postal_round',
      description:
        'Read delivery progress, stamps, upgrades, player position and the current destination.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute(input) {
        if (!input || typeof input !== 'object' || Object.keys(input).length)
          throw new Error('Expected an empty object.');
        return engine.getStatus();
      },
    },
    {
      name: 'purchase_route_improvement',
      description:
        'Spend earned stamps on a bridge, garden, woodland shortcut or trail boots. Updates the same island and balance as Make a path.',
      inputSchema: {
        type: 'object',
        properties: { upgrade: { type: 'string', enum: Object.keys(costs) } },
        required: ['upgrade'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute(input) {
        if (
          !input ||
          typeof input !== 'object' ||
          Object.keys(input).length !== 1 ||
          !('upgrade' in input) ||
          typeof input.upgrade !== 'string' ||
          !Object.hasOwn(costs, input.upgrade)
        )
          throw new Error('Choose bridge, garden, shortcut or boots.');
        const id = input.upgrade as Upgrade,
          s = engine.getStatus();
        if (s.upgrades[id]) throw new Error('Already built.');
        if (s.stamps < costs[id])
          throw new Error(
            'Not enough stamps. Complete another delivery first.',
          );
        engine.upgrade(id);
        return engine.getStatus();
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Optional browser proposal; the regular game remains available. */
    }
  }
  return () => lifecycle.abort();
}

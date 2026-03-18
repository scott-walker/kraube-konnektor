import type { ClientOptions, QueryOptions } from '../types/index.js';
import {
  FLAG_PRINT, FLAG_OUTPUT_FORMAT, FLAG_VERBOSE, FLAG_INPUT_FORMAT,
  FLAG_CONTINUE, FLAG_RESUME, FLAG_FORK_SESSION, FLAG_MODEL,
  FLAG_FALLBACK_MODEL, FLAG_EFFORT, FLAG_PERMISSION_MODE,
  FLAG_ALLOWED_TOOLS, FLAG_DISALLOWED_TOOLS, FLAG_TOOLS,
  FLAG_SYSTEM_PROMPT, FLAG_APPEND_SYSTEM_PROMPT, FLAG_MAX_TURNS,
  FLAG_MAX_BUDGET, FLAG_ADD_DIR, FLAG_MCP_CONFIG, FLAG_STRICT_MCP_CONFIG,
  FLAG_AGENTS, FLAG_AGENT, FLAG_JSON_SCHEMA, FLAG_WORKTREE,
  FLAG_NO_SESSION_PERSISTENCE, FLAG_NAME, FLAG_SETTINGS,
  FORMAT_JSON, FORMAT_STREAM_JSON,
} from '../constants.js';

/**
 * Builds the CLI argument array from merged client + query options.
 *
 * ## Separation of concerns
 *
 * ArgsBuilder is purely functional — it takes options and returns `string[]`.
 * It has no side effects, no I/O, and no dependency on the executor.
 * This makes it trivially testable and replaceable.
 *
 * ## Merging strategy
 *
 * Query-level options override client-level options. Arrays are replaced, not merged.
 * This follows the principle of least surprise: if you set `allowedTools` per-query,
 * you get exactly those tools, not a union with client defaults.
 */

/** Merged options ready for argument building. */
export interface ResolvedOptions {
  readonly prompt?: string;
  readonly outputFormat: 'json' | 'stream-json';
  readonly inputFormat?: 'stream-json';
  readonly cwd: string;
  readonly model?: string;
  readonly effortLevel?: string;
  readonly fallbackModel?: string;
  readonly permissionMode?: string;
  readonly allowedTools?: readonly string[];
  readonly disallowedTools?: readonly string[];
  readonly systemPrompt?: string;
  readonly appendSystemPrompt?: string;
  readonly maxTurns?: number;
  readonly maxBudget?: number;
  readonly additionalDirs?: readonly string[];
  readonly mcpConfig?: string | readonly string[];
  readonly mcpServers?: Readonly<Record<string, unknown>>;
  readonly agents?: Readonly<Record<string, unknown>>;
  readonly hooks?: Readonly<Record<string, unknown>>;
  readonly noSessionPersistence?: boolean;
  readonly worktree?: boolean | string;
  readonly sessionId?: string;
  readonly continueSession?: boolean;
  readonly forkSession?: boolean;
  readonly schema?: Record<string, unknown>;
  readonly agent?: string;
  readonly tools?: readonly string[];
  readonly name?: string;
  readonly strictMcpConfig?: boolean;
}

/**
 * Merge client-level defaults with per-query overrides.
 */
export function mergeOptions(
  client: ClientOptions,
  query: QueryOptions | undefined,
  extra: {
    prompt: string;
    outputFormat: 'json' | 'stream-json';
    sessionId?: string;
    continueSession?: boolean;
    forkSession?: boolean;
  },
): ResolvedOptions {
  return {
    prompt: extra.prompt,
    outputFormat: extra.outputFormat,
    cwd: query?.cwd ?? client.cwd ?? process.cwd(),
    model: query?.model ?? client.model,
    effortLevel: query?.effortLevel ?? client.effortLevel,
    fallbackModel: client.fallbackModel,
    permissionMode: query?.permissionMode ?? client.permissionMode,
    allowedTools: query?.allowedTools ?? client.allowedTools,
    disallowedTools: query?.disallowedTools ?? client.disallowedTools,
    systemPrompt: query?.systemPrompt ?? client.systemPrompt,
    appendSystemPrompt: query?.appendSystemPrompt ?? client.appendSystemPrompt,
    maxTurns: query?.maxTurns ?? client.maxTurns,
    maxBudget: query?.maxBudget ?? client.maxBudget,
    additionalDirs: query?.additionalDirs ?? client.additionalDirs,
    mcpConfig: client.mcpConfig,
    mcpServers: client.mcpServers,
    agents: client.agents,
    hooks: client.hooks,
    noSessionPersistence: client.noSessionPersistence,
    worktree: query?.worktree,
    sessionId: extra.sessionId,
    continueSession: extra.continueSession,
    forkSession: extra.forkSession,
    schema: query?.schema ?? client.schema,
    agent: query?.agent ?? client.agent,
    tools: query?.tools ?? client.tools,
    name: client.name,
    strictMcpConfig: client.strictMcpConfig,
  };
}

/**
 * Convert resolved options into a CLI argument array.
 *
 * @returns Array of strings to pass to `spawn('claude', args)`.
 */
export function buildArgs(options: ResolvedOptions): string[] {
  const args: string[] = [FLAG_PRINT, FLAG_OUTPUT_FORMAT, options.outputFormat];

  // BUG-1 fix: stream-json requires --verbose
  if (options.outputFormat === FORMAT_STREAM_JSON) {
    args.push(FLAG_VERBOSE);
  }

  // ── Input format (bidirectional streaming) ─────────────────────
  if (options.inputFormat) {
    args.push(FLAG_INPUT_FORMAT, options.inputFormat);
  }

  // ── Prompt ──────────────────────────────────────────────────────
  if (options.prompt) {
    args.push(options.prompt);
  }

  // ── Session ─────────────────────────────────────────────────────
  if (options.continueSession) {
    args.push(FLAG_CONTINUE);
  }
  if (options.sessionId) {
    args.push(FLAG_RESUME, options.sessionId);
  }
  if (options.forkSession) {
    args.push(FLAG_FORK_SESSION);
  }

  // ── Model ───────────────────────────────────────────────────────
  if (options.model) {
    args.push(FLAG_MODEL, options.model);
  }
  if (options.fallbackModel) {
    args.push(FLAG_FALLBACK_MODEL, options.fallbackModel);
  }
  if (options.effortLevel) {
    args.push(FLAG_EFFORT, options.effortLevel);
  }

  // ── Permissions ─────────────────────────────────────────────────
  if (options.permissionMode) {
    args.push(FLAG_PERMISSION_MODE, options.permissionMode);
  }
  if (options.allowedTools?.length) {
    args.push(FLAG_ALLOWED_TOOLS, ...options.allowedTools);
  }
  if (options.disallowedTools?.length) {
    args.push(FLAG_DISALLOWED_TOOLS, ...options.disallowedTools);
  }

  // ── Tools (built-in set restriction) ────────────────────────────
  if (options.tools) {
    if (options.tools.length === 0) {
      args.push(FLAG_TOOLS, '');
    } else {
      args.push(FLAG_TOOLS, ...options.tools);
    }
  }

  // ── System prompt ───────────────────────────────────────────────
  if (options.systemPrompt) {
    args.push(FLAG_SYSTEM_PROMPT, options.systemPrompt);
  }
  if (options.appendSystemPrompt) {
    args.push(FLAG_APPEND_SYSTEM_PROMPT, options.appendSystemPrompt);
  }

  // ── Limits ──────────────────────────────────────────────────────
  if (options.maxTurns !== undefined) {
    args.push(FLAG_MAX_TURNS, String(options.maxTurns));
  }
  if (options.maxBudget !== undefined) {
    args.push(FLAG_MAX_BUDGET, String(options.maxBudget));
  }

  // ── Directories ─────────────────────────────────────────────────
  if (options.additionalDirs?.length) {
    for (const dir of options.additionalDirs) {
      args.push(FLAG_ADD_DIR, dir);
    }
  }

  // ── MCP ─────────────────────────────────────────────────────────
  if (options.mcpConfig) {
    const configs = Array.isArray(options.mcpConfig) ? options.mcpConfig : [options.mcpConfig];
    for (const cfg of configs) {
      args.push(FLAG_MCP_CONFIG, cfg);
    }
  }
  if (options.mcpServers && Object.keys(options.mcpServers).length > 0) {
    args.push(FLAG_MCP_CONFIG, JSON.stringify({ mcpServers: options.mcpServers }));
  }
  if (options.strictMcpConfig) {
    args.push(FLAG_STRICT_MCP_CONFIG);
  }

  // ── Agents ──────────────────────────────────────────────────────
  if (options.agents && Object.keys(options.agents).length > 0) {
    args.push(FLAG_AGENTS, JSON.stringify(options.agents));
  }
  if (options.agent) {
    args.push(FLAG_AGENT, options.agent);
  }

  // ── Structured output ───────────────────────────────────────────
  if (options.schema) {
    args.push(FLAG_JSON_SCHEMA, JSON.stringify(options.schema));
  }

  // ── Worktree ────────────────────────────────────────────────────
  if (options.worktree) {
    if (typeof options.worktree === 'string') {
      args.push(FLAG_WORKTREE, options.worktree);
    } else {
      args.push(FLAG_WORKTREE);
    }
  }

  // ── Misc ────────────────────────────────────────────────────────
  if (options.noSessionPersistence) {
    args.push(FLAG_NO_SESSION_PERSISTENCE);
  }
  if (options.name) {
    args.push(FLAG_NAME, options.name);
  }

  // ── Hooks (via --settings) ──────────────────────────────────────
  if (options.hooks && Object.keys(options.hooks).length > 0) {
    args.push(FLAG_SETTINGS, JSON.stringify({ hooks: options.hooks }));
  }

  return args;
}

/**
 * Resolve environment variables from client + query options.
 */
export function resolveEnv(
  client: ClientOptions,
  query: QueryOptions | undefined,
): Record<string, string> {
  const env: Record<string, string> = {};

  if (client.env) {
    Object.assign(env, client.env);
  }
  if (query?.env) {
    Object.assign(env, query.env);
  }

  return env;
}

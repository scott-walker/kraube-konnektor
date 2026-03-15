import { ValidationError } from '../errors/errors.js';
import { VALID_PERMISSION_MODES, VALID_EFFORT_LEVELS } from '../constants.js';
import type { ClientOptions, QueryOptions } from '../types/index.js';

/**
 * Validates client options at construction time.
 * Fails fast with descriptive error messages.
 */
export function validateClientOptions(options: ClientOptions): void {
  if (options.maxTurns !== undefined && (options.maxTurns < 1 || !Number.isInteger(options.maxTurns))) {
    throw new ValidationError('maxTurns', 'must be a positive integer');
  }
  if (options.maxBudget !== undefined && options.maxBudget <= 0) {
    throw new ValidationError('maxBudget', 'must be a positive number');
  }
  if (options.permissionMode !== undefined) {
    if (![...VALID_PERMISSION_MODES].includes(options.permissionMode)) {
      throw new ValidationError('permissionMode', `must be one of: ${VALID_PERMISSION_MODES.join(', ')}`);
    }
  }
  if (options.effortLevel !== undefined) {
    if (![...VALID_EFFORT_LEVELS].includes(options.effortLevel)) {
      throw new ValidationError('effortLevel', `must be one of: ${VALID_EFFORT_LEVELS.join(', ')}`);
    }
  }
}

/**
 * Validates per-query options.
 */
export function validateQueryOptions(options: QueryOptions): void {
  if (options.maxTurns !== undefined && (options.maxTurns < 1 || !Number.isInteger(options.maxTurns))) {
    throw new ValidationError('maxTurns', 'must be a positive integer');
  }
  if (options.maxBudget !== undefined && options.maxBudget <= 0) {
    throw new ValidationError('maxBudget', 'must be a positive number');
  }
}

/**
 * Validates that a prompt is non-empty.
 */
export function validatePrompt(prompt: string): void {
  if (!prompt || !prompt.trim()) {
    throw new ValidationError('prompt', 'must be a non-empty string');
  }
}

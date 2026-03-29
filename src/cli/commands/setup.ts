import { execSync, spawn } from 'node:child_process';
import chalk from 'chalk';
import ora from 'ora';

const REQUIRED_NODE_MAJOR = 18;
const CLAUDE_PACKAGE = '@anthropic-ai/claude-code';

interface StepResult {
  ok: boolean;
  message?: string;
}

function banner(): void {
  console.log();
  console.log(chalk.bold('  Claude Connector — Setup'));
  console.log(chalk.dim('  ─────────────────────────'));
  console.log();
}

function checkNodeVersion(): StepResult {
  const major = parseInt(process.versions.node, 10);
  if (major >= REQUIRED_NODE_MAJOR) {
    return { ok: true, message: `Node.js ${process.versions.node}` };
  }
  return { ok: false, message: `Node.js ${process.versions.node} — requires >= ${REQUIRED_NODE_MAJOR}` };
}

function isClaudeInstalled(): boolean {
  try {
    execSync('claude --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getClaudeVersion(): string {
  try {
    return execSync('claude --version', { stdio: 'pipe', encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

function isClaudeAuthenticated(): boolean {
  try {
    const output = execSync('claude auth status', { stdio: 'pipe', encoding: 'utf-8' });
    return output.toLowerCase().includes('logged in') || !output.toLowerCase().includes('not logged');
  } catch {
    return false;
  }
}

async function installClaude(): Promise<StepResult> {
  const spinner = ora('Installing Claude Code...').start();
  try {
    execSync(`npm install -g ${CLAUDE_PACKAGE}`, { stdio: 'pipe' });
    const version = getClaudeVersion();
    spinner.succeed(`Claude Code installed ${chalk.dim(`(${version})`)}`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    spinner.fail('Failed to install Claude Code');
    console.log(chalk.red(`  ${message}`));
    return { ok: false };
  }
}

async function authenticate(): Promise<StepResult> {
  console.log();
  console.log(chalk.bold('  Authentication'));
  console.log(chalk.dim('  Follow the instructions below from Claude Code:\n'));

  return new Promise((resolve) => {
    const child = spawn('claude', ['login'], {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      console.log();
      if (code === 0) {
        resolve({ ok: true });
      } else {
        resolve({ ok: false, message: `claude login exited with code ${code}` });
      }
    });

    child.on('error', (err) => {
      console.log();
      resolve({ ok: false, message: err.message });
    });
  });
}

function printResult(ok: boolean, label: string): void {
  const icon = ok ? chalk.green('✔') : chalk.red('✖');
  console.log(`  ${icon} ${label}`);
}

export async function setup(): Promise<void> {
  banner();

  // Step 1: Check Node.js
  const nodeCheck = checkNodeVersion();
  printResult(nodeCheck.ok, nodeCheck.message!);
  if (!nodeCheck.ok) {
    console.log();
    console.log(chalk.red('  Setup aborted. Please upgrade Node.js.'));
    process.exit(1);
  }

  // Step 2: Check / install Claude Code
  if (isClaudeInstalled()) {
    const version = getClaudeVersion();
    printResult(true, `Claude Code ${chalk.dim(`(${version})`)}`);
  } else {
    printResult(false, 'Claude Code not found');
    console.log();
    const install = await installClaude();
    if (!install.ok) {
      console.log();
      console.log(chalk.red('  Setup aborted.'));
      process.exit(1);
    }
  }

  // Step 3: Check / run authentication
  if (isClaudeAuthenticated()) {
    printResult(true, 'Authenticated');
    console.log();
    console.log(chalk.green.bold('  All set! You can now use Claude Connector.'));
    console.log(chalk.dim('  Try: claude "Hello, world!"'));
    console.log();
    return;
  }

  const authResult = await authenticate();
  if (!authResult.ok) {
    printResult(false, `Authentication failed${authResult.message ? `: ${authResult.message}` : ''}`);
    console.log();
    console.log(chalk.red('  Setup aborted.'));
    process.exit(1);
  }

  // Verify
  if (isClaudeAuthenticated()) {
    printResult(true, 'Authenticated');
  } else {
    printResult(false, 'Authentication could not be verified');
    console.log(chalk.yellow('  Try running: claude login'));
    console.log();
    return;
  }

  console.log();
  console.log(chalk.green.bold('  All set! You can now use Claude Connector.'));
  console.log(chalk.dim('  Try: claude "Hello, world!"'));
  console.log();
}

#!/usr/bin/env bun
import { Command, CommanderError } from "commander";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

import { getOutputMode } from "./index";
import { getConfigPath, readConfig, readConfigSync, writeConfig } from "./config";
import { Samrian, SamrianError } from "@samrian/sdk";

const program = new Command();
program.name("samrian").description("Samrian automation CLI").version("0.1.0").exitOverride();
program.option("--url <url>", "Samrian API URL");
program.option("--output <mode>", "table, json, or jsonl");
program.option("--request-id <id>", "request and correlation ID");
program
  .command("completion")
  .argument("<shell>", "powershell, bash, or zsh")
  .action((shell: string) => {
    const commands = program.commands.map((command) => command.name()).join(" ");
    if (shell === "powershell") {
      process.stdout.write(
        `Register-ArgumentCompleter -Native -CommandName samrian -ScriptBlock { param($wordToComplete) '${commands}'.Split(' ') | Where-Object { $_ -like "$wordToComplete*" } }\n`
      );
      return;
    }
    if (shell === "bash") {
      process.stdout.write(`complete -W "${commands}" samrian\n`);
      return;
    }
    if (shell === "zsh") {
      process.stdout.write(`#compdef samrian\n_arguments '1:command:(${commands})'\n`);
      return;
    }
    throw new CliError("shell must be powershell, bash, or zsh", 2);
  });
program.command("capabilities").action(() => show((client) => client.capabilities()));
program.command("limits").action(() => show((client) => client.limits()));
const config = program.command("config");
config
  .command("set-url")
  .argument("<url>")
  .action(async (url: string) => {
    await writeConfig(getConfigPath(), { url });
    writeOutput({ url: new URL(url).origin }, outputMode());
  });
config.command("list").action(async () => writeOutput(await readConfig(), outputMode()));
program
  .command("auth")
  .command("whoami")
  .action(async () => {
    writeOutput(await createClient().identity.me(), outputMode());
  });

const contacts = program.command("contacts");
contacts
  .command("list")
  .option("--limit <number>", "page size", "50")
  .option("--cursor <cursor>", "next page cursor")
  .action(async (options: { limit: string; cursor?: string }) => {
    const limit = parseLimit(options.limit);
    writeOutput(
      await createClient().contacts.list({ limit, cursor: options.cursor }),
      outputMode()
    );
  });
contacts
  .command("get")
  .argument("<id>")
  .action(async (id: string) => {
    writeOutput(await createClient().contacts.get(id), outputMode());
  });
contacts
  .command("import")
  .requiredOption("--file <path>", "JSON file, or - for stdin")
  .option("--idempotency-key <key>", "retry-safe request key")
  .option("--dry-run", "preview without writing")
  .action(async (options: { file: string; idempotencyKey?: string; dryRun?: boolean }) => {
    const input = await readJson(options.file);
    if (options.dryRun) {
      writeOutput(await createClient().contacts.previewImport(input), outputMode());
      return;
    }
    const idempotencyKey = options.idempotencyKey ?? crypto.randomUUID();
    writeOutput(await createClient().contacts.import(input, { idempotencyKey }), outputMode());
  });
contacts
  .command("update")
  .argument("<id>")
  .requiredOption("--file <path>", "JSON file, or - for stdin")
  .action((id: string, options: { file: string }) =>
    show(async (client) => client.contacts.update(id, await readJson(options.file)))
  );

const groups = program.command("groups");
groups
  .command("list")
  .option("--limit <number>", "page size", "50")
  .action((options: { limit: string }) =>
    show((client) => client.groups.list({ limit: parseLimit(options.limit) }))
  );
groups
  .command("get")
  .argument("<id>")
  .action((id: string) => show((client) => client.groups.get(id)));
groups
  .command("preview")
  .argument("<id>")
  .option("--limit <number>", "sample size", "10")
  .action((id: string, options: { limit: string }) =>
    show((client) => client.groups.preview(id, { limit: parseLimit(options.limit) }))
  );
groups
  .command("create")
  .requiredOption("--file <path>", "JSON file, or - for stdin")
  .option("--idempotency-key <key>", "retry-safe request key")
  .action((options: { file: string; idempotencyKey?: string }) =>
    show(async (client) =>
      client.groups.create(await readJson(options.file), {
        idempotencyKey: options.idempotencyKey ?? crypto.randomUUID(),
      })
    )
  );
groups
  .command("update")
  .argument("<id>")
  .requiredOption("--file <path>", "JSON file, or - for stdin")
  .action((id: string, options: { file: string }) =>
    show(async (client) => client.groups.update(id, await readJson(options.file)))
  );

const campaigns = program.command("campaigns");
campaigns
  .command("list")
  .option("--limit <number>", "page size", "50")
  .action((options: { limit: string }) =>
    show((client) => client.campaigns.list({ limit: parseLimit(options.limit) }))
  );
campaigns
  .command("get")
  .argument("<id>")
  .action((id: string) => show((client) => client.campaigns.get(id)));
campaigns
  .command("stats")
  .argument("<id>")
  .action((id: string) => show((client) => client.campaigns.stats(id)));
campaigns
  .command("validate")
  .argument("<id>")
  .requiredOption("--mailbox <ids...>", "mailbox IDs")
  .action((id: string, options: { mailbox: string[] }) =>
    show((client) => client.campaigns.validate(id, { mailboxIds: options.mailbox }))
  );
campaigns
  .command("create")
  .requiredOption("--file <path>", "JSON file, or - for stdin")
  .option("--idempotency-key <key>", "retry-safe request key")
  .action((options: { file: string; idempotencyKey?: string }) =>
    show(async (client) =>
      client.campaigns.create(await readJson(options.file), {
        idempotencyKey: options.idempotencyKey ?? crypto.randomUUID(),
      })
    )
  );
campaigns
  .command("update")
  .argument("<id>")
  .requiredOption("--file <path>", "JSON file, or - for stdin")
  .action((id: string, options: { file: string }) =>
    show(async (client) => client.campaigns.update(id, await readJson(options.file)))
  );
campaigns
  .command("launch")
  .argument("<id>")
  .requiredOption("--mailbox <ids...>", "mailbox IDs")
  .option("--idempotency-key <key>", "retry-safe request key")
  .option("--yes", "confirm launch")
  .action(
    async (id: string, options: { mailbox: string[]; idempotencyKey?: string; yes?: boolean }) => {
      await confirmHighImpact(`Launch campaign ${id}`, options.yes);
      await show((client) =>
        client.campaigns.launch(
          id,
          { mailboxIds: options.mailbox },
          { idempotencyKey: options.idempotencyKey ?? crypto.randomUUID() }
        )
      );
    }
  );

const mailboxes = program.command("mailboxes");
mailboxes
  .command("list")
  .option("--limit <number>", "page size", "50")
  .action((options: { limit: string }) =>
    show((client) => client.mailboxes.list({ limit: parseLimit(options.limit) }))
  );
mailboxes
  .command("check")
  .argument("<id>")
  .action((id: string) => show((client) => client.mailboxes.check(id)));

const inbox = program.command("inbox");
inbox
  .command("list")
  .option("--limit <number>", "page size", "50")
  .action((options: { limit: string }) =>
    show((client) => client.inbox.list({ limit: parseLimit(options.limit) }))
  );
inbox
  .command("get")
  .argument("<id>")
  .action((id: string) => show((client) => client.inbox.get(id)));
inbox
  .command("reply")
  .argument("<id>")
  .requiredOption("--body-file <path>", "reply text file, or - for stdin")
  .option("--subject <subject>")
  .option("--idempotency-key <key>", "retry-safe request key")
  .option("--yes", "confirm reply")
  .action(
    async (
      id: string,
      options: { bodyFile: string; subject?: string; idempotencyKey?: string; yes?: boolean }
    ) => {
      await confirmHighImpact(`Reply to thread ${id}`, options.yes);
      const body =
        options.bodyFile === "-" ? await readStdin() : await readFile(options.bodyFile, "utf8");
      await show((client) =>
        client.inbox.reply(
          id,
          { body, ...(options.subject ? { subject: options.subject } : {}) },
          { idempotencyKey: options.idempotencyKey ?? crypto.randomUUID() }
        )
      );
    }
  );

const analytics = program.command("analytics");
analytics.command("org").action(() => show((client) => client.analytics.org()));
analytics
  .command("campaign")
  .argument("<id>")
  .action((id: string) => show((client) => client.analytics.campaign(id)));

const blocklist = program.command("blocklist");
blocklist
  .command("list")
  .option("--limit <number>", "page size", "50")
  .action((options: { limit: string }) =>
    show((client) => client.blocklist.list({ limit: parseLimit(options.limit) }))
  );
blocklist
  .command("add")
  .argument("<email>")
  .option("--reason <reason>", "manual, unsubscribed, or bounced_hard", "manual")
  .option("--idempotency-key <key>", "retry-safe request key")
  .action((email: string, options: { reason: string; idempotencyKey?: string }) =>
    show((client) =>
      client.blocklist.add(
        { email, reason: options.reason },
        { idempotencyKey: options.idempotencyKey ?? crypto.randomUUID() }
      )
    )
  );
blocklist
  .command("remove")
  .argument("<id>")
  .option("--yes", "confirm removal")
  .action(async (id: string, options: { yes?: boolean }) => {
    await confirmHighImpact(`Remove blocklist entry ${id}`, options.yes);
    await show((client) => client.blocklist.remove(id));
  });

const domains = program.command("domains");
domains
  .command("get")
  .argument("<domain>")
  .action((domain: string) => show((client) => client.domains.get(domain)));
domains
  .command("check")
  .argument("<domain>")
  .action((domain: string) => show((client) => client.domains.check(domain)));
class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode: number
  ) {
    super(message);
  }
}

function createClient() {
  const options = program.opts<{ url?: string; requestId?: string }>();
  const token = process.env.SAMRIAN_TOKEN;
  if (!token) throw new CliError("SAMRIAN_TOKEN is required", 3);
  return new Samrian({
    baseUrl:
      options.url ?? process.env.SAMRIAN_URL ?? readConfigSync().url ?? "http://localhost:3000",
    token,
    ...(options.requestId
      ? { correlationId: options.requestId, createId: () => options.requestId! }
      : {}),
  });
}

function outputMode() {
  const options = program.opts<{ output?: "table" | "json" | "jsonl" }>();
  return getOutputMode({ isTTY: Boolean(process.stdout.isTTY), output: options.output });
}

async function show(task: (client: Samrian) => Promise<unknown>) {
  writeOutput(await task(createClient()), outputMode());
}

function parseLimit(value: string) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new CliError("limit must be between 1 and 100", 2);
  }
  return limit;
}

async function readStdin() {
  let value = "";
  for await (const chunk of process.stdin) value += chunk;
  return value;
}

async function readJson(path: string): Promise<unknown> {
  const text = path === "-" ? await readStdin() : await readFile(path, "utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new CliError("file must contain valid JSON", 2);
  }
}

async function confirmHighImpact(label: string, confirmed?: boolean) {
  if (confirmed) return;
  if (!process.stdin.isTTY) throw new CliError("--yes is required in non-interactive mode", 2);
  const prompt = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await prompt.question(`${label}? Type yes to continue: `);
    if (answer.trim().toLowerCase() !== "yes") throw new CliError("Cancelled", 2);
  } finally {
    prompt.close();
  }
}

function writeOutput(data: unknown, mode: "table" | "json" | "jsonl") {
  if (mode === "table" && data && typeof data === "object" && !Array.isArray(data)) {
    process.stdout.write(
      `${Object.entries(data)
        .map(([key, value]) => `${key}\t${String(value)}`)
        .join("\n")}\n`
    );
    return;
  }

  process.stdout.write(`${JSON.stringify({ ok: true, data })}\n`);
}

function mapError(error: unknown): number {
  if (!(error instanceof SamrianError)) return 1;
  if (
    ["UNAUTHENTICATED", "INVALID_CREDENTIAL", "EXPIRED_CREDENTIAL", "REVOKED_CREDENTIAL"].includes(
      error.code
    )
  )
    return 3;
  if (["FORBIDDEN", "MISSING_SCOPE"].includes(error.code)) return 4;
  if (error.code === "NOT_FOUND") return 5;
  if (["VALIDATION_FAILED", "IDEMPOTENCY_REQUIRED"].includes(error.code)) return 6;
  if (["CONFLICT", "IDEMPOTENCY_CONFLICT"].includes(error.code)) return 7;
  if (error.code === "RATE_LIMITED") return 8;
  if (error.code === "PROVIDER_UNAVAILABLE") return 9;
  if (error.code === "NETWORK_ERROR") return 10;
  return 1;
}

program.parseAsync().catch((error: unknown) => {
  if (error instanceof CommanderError && error.exitCode === 0) return;
  const code =
    error instanceof CommanderError
      ? 2
      : error instanceof CliError
        ? error.exitCode
        : mapError(error);
  const message = error instanceof Error ? error.message : "Unexpected error";
  process.stderr.write(`${JSON.stringify({ ok: false, error: { message, code } })}\n`);
  process.exitCode = code;
});

export type OutputMode = "table" | "json" | "jsonl";

export function getOutputMode(input: { isTTY: boolean; output?: OutputMode }): OutputMode {
  return input.output ?? (input.isTTY ? "table" : "json");
}

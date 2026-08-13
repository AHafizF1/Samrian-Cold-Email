import { auditDataProtection } from "../../src/server/data/protection";

const result = auditDataProtection(process.env);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;

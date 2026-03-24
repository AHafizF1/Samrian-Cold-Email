import type { InngestFunction } from "inngest";
import { sendEmail } from "./sendEmail";
import { pollMailboxes } from "./pollMailboxes";
import { resetCounters } from "./resetCounters";
import { processBounce } from "./processBounce";

// All Phase 3 Inngest workers: send, poll, reset, bounce
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const functions: InngestFunction.Any[] = [sendEmail, pollMailboxes, resetCounters, processBounce];

import type { InngestFunction } from "inngest";
import { sendCampaignEmail } from "./sendCampaignEmail";
import { pollMailboxes, pollSingleMailbox } from "./pollMailboxes";
import { resetCounters } from "./resetCounters";
import { processBounce } from "./processBounce";
import { dispatchCampaignSends } from "./dispatchCampaignSends";
import { checkMailboxes, checkSingleMailbox } from "./checkMailboxes";
import { evaluateMailboxRamps } from "./evaluateMailboxRamps";

// Active Inngest workers: send (new), poll, reset, bounce
// sendEmail.ts is obsolete — replaced by sendCampaignEmail.ts
export const functions: InngestFunction.Any[] = [
  sendCampaignEmail,
  dispatchCampaignSends,
  pollMailboxes,
  pollSingleMailbox,
  checkMailboxes,
  checkSingleMailbox,
  evaluateMailboxRamps,
  resetCounters,
  processBounce,
];

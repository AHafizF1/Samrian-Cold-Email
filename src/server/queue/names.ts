export const JOB_NAMES = {
  campaignSend: "campaign.send",
  campaignDispatch: "campaign.dispatch",
  mailboxPoll: "mailbox.poll",
  mailboxCheck: "mailbox.check",
  mailboxRamp: "mailbox.ramp",
  emailBounce: "email.bounce",
  resetCounters: "maintenance.reset-counters",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "cold-email",
  signingKey: process.env.INNGEST_SIGNING_KEY,
});

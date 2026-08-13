export type StatsSummary = {
  sent: number;
  failed: number;
  replies: number;
  unsubscribes: number;
  hardBounces: number;
  softBounces: number;
  totalClicks: number;
  uniqueClicks: number;
  totalOpens: number;
  uniqueOpens: number;
  openTrackingEnabled: boolean;
  estimatedOpenRate: number | null;
  replyRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  clickRate: number;
};

export function buildStatsSummary(
  counts: Omit<
    StatsSummary,
    "estimatedOpenRate" | "replyRate" | "bounceRate" | "unsubscribeRate" | "clickRate"
  > & {
    openTrackingEnabled?: boolean;
  }
): StatsSummary {
  const sent = counts.sent;
  const openTrackingEnabled = counts.openTrackingEnabled ?? false;

  return {
    ...counts,
    openTrackingEnabled,
    estimatedOpenRate: openTrackingEnabled && sent > 0 ? (counts.uniqueOpens / sent) * 100 : null,
    replyRate: sent > 0 ? (counts.replies / sent) * 100 : 0,
    bounceRate: sent > 0 ? ((counts.hardBounces + counts.softBounces) / sent) * 100 : 0,
    unsubscribeRate: sent > 0 ? (counts.unsubscribes / sent) * 100 : 0,
    clickRate: sent > 0 ? (counts.uniqueClicks / sent) * 100 : 0,
  };
}

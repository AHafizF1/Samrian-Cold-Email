import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { BOUNCE_STATUSES, CAMPAIGN_STATUSES, CONTACT_STATUSES } from "@/lib/constants";
import {
  CheckCircle2,
  CircleDashed,
  Clock,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  Send,
  XCircle,
} from "lucide-react";

type StatusMap = Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
    icon: React.ComponentType<{ className?: string }>;
  }
>;

const statusConfig: StatusMap = {
  // Campaign Statuses
  draft: { label: "Draft", variant: "secondary", icon: CircleDashed },
  scheduled: { label: "Scheduled", variant: "warning", icon: Clock },
  running: { label: "Running", variant: "default", icon: PlayCircle },
  paused: { label: "Paused", variant: "outline", icon: PauseCircle },
  completed: { label: "Completed", variant: "success", icon: CheckCircle2 },
  error: { label: "Error", variant: "destructive", icon: AlertCircle },

  // Contact/Assignment Statuses
  pending: { label: "Pending", variant: "secondary", icon: CircleDashed },
  sent: { label: "Sent", variant: "default", icon: Send },
  replied: { label: "Replied", variant: "success", icon: CheckCircle2 },
  bounced: { label: "Bounced", variant: "destructive", icon: XCircle },
  unsubscribed: { label: "Unsubscribed", variant: "outline", icon: AlertCircle },

  // Mailbox Statuses
  active: { label: "Active", variant: "success", icon: CheckCircle2 },
  disconnected: { label: "Disconnected", variant: "destructive", icon: AlertCircle },
};

// Add success and warning variants to standard Tailwind config mentally,
// For now we map them to standard Tailwind classes in the component.

interface StatusBadgeProps {
  status: string;
  className?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const config = statusConfig[normalizedStatus] || {
    label: status,
    variant: "outline",
    icon: CircleDashed,
  };

  const Icon = config.icon;

  // Map our semantic variants to specific accessible color combinations
  let colorClasses = "";
  switch (config.variant) {
    case "success":
      colorClasses =
        "bg-green-500/15 text-green-700 dark:text-green-400 dark:bg-green-500/10 border-green-500/20";
      break;
    case "warning":
      colorClasses =
        "bg-amber-500/15 text-amber-700 dark:text-amber-400 dark:bg-amber-500/10 border-amber-500/20";
      break;
    case "destructive":
      colorClasses =
        "bg-destructive/15 text-destructive dark:text-red-400 dark:bg-destructive/10 border-destructive/20";
      break;
    case "secondary":
      colorClasses = "bg-secondary text-secondary-foreground border-transparent";
      break;
    case "default":
      colorClasses = "bg-primary/15 text-primary dark:bg-primary/10 border-primary/20";
      break;
    default:
      colorClasses = "text-muted-foreground border-border";
  }

  return (
    <Badge
      variant="outline"
      className={`font-medium shadow-none h-6 px-2 flex items-center gap-1.5 ${colorClasses} ${className}`}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}

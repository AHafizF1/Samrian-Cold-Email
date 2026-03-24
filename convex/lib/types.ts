/**
 * Shared TypeScript types used across the application
 */

import { Doc, Id } from "../_generated/dataModel";

// Re-export commonly used types
export type { Doc, Id };

// Campaign types
export type Campaign = Doc<"campaigns">;
export type CampaignId = Id<"campaigns">;
export type CampaignStatus = Campaign["status"];

// Contact types
export type Contact = Doc<"contacts">;
export type ContactId = Id<"contacts">;

// Campaign-Contact assignment types
export type CampaignContact = Doc<"campaignContacts">;
export type CampaignContactId = Id<"campaignContacts">;
export type ContactStatus = CampaignContact["status"];

// Mailbox types
export type Mailbox = Doc<"mailboxes">;
export type MailboxId = Id<"mailboxes">;

// Schedule type
export type Schedule = Campaign["schedule"];

// Bulk operation result type
export interface BulkOperationResult<T> {
  success: T[];
  errors: Array<{
    index: number;
    error: string;
  }>;
}

// Campaign statistics type
export interface CampaignStats {
  campaignId: CampaignId;
  total: number;
  active: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  completed: number;
}

// Pagination types
export interface PaginationArgs {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

// Auth context types
export interface AuthContext {
  userId: string;
  orgId: string;
}

// Permission types
export type PermissionResource = "campaign" | "contact" | "mailbox" | "organization";
export type PermissionAction = "create" | "read" | "update" | "delete" | "import";

export type Permissions = {
  [resource in PermissionResource]?: PermissionAction[];
};

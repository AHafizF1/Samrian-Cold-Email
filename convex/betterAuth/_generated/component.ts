/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> = {
  adapter: {
    create: FunctionReference<
      "mutation",
      "internal",
      {
        input:
          | {
              data: {
                createdAt: number;
                displayUsername?: null | string;
                email: string;
                emailVerified: boolean;
                image?: null | string;
                isAnonymous?: null | boolean;
                name: string;
                phoneNumber?: null | string;
                phoneNumberVerified?: null | boolean;
                twoFactorEnabled?: null | boolean;
                updatedAt: number;
                userId?: null | string;
                username?: null | string;
              };
              model: "user";
            }
          | {
              data: {
                activeOrganizationId?: null | string;
                createdAt: number;
                expiresAt: number;
                ipAddress?: null | string;
                token: string;
                updatedAt: number;
                userAgent?: null | string;
                userId: string;
              };
              model: "session";
            }
          | {
              data: {
                accessToken?: null | string;
                accessTokenExpiresAt?: null | number;
                accountId: string;
                createdAt: number;
                idToken?: null | string;
                password?: null | string;
                providerId: string;
                refreshToken?: null | string;
                refreshTokenExpiresAt?: null | number;
                scope?: null | string;
                updatedAt: number;
                userId: string;
              };
              model: "account";
            }
          | {
              data: {
                createdAt: number;
                expiresAt: number;
                identifier: string;
                updatedAt: number;
                value: string;
              };
              model: "verification";
            }
          | {
              data: {
                createdAt: number;
                logo?: string;
                metadata?: any;
                name: string;
                slug: string;
              };
              model: "organization";
            }
          | {
              data: {
                createdAt: number;
                organizationId: string;
                role: string;
                userId: string;
              };
              model: "member";
            }
          | {
              data: {
                email: string;
                expiresAt: number;
                inviterId: string;
                organizationId: string;
                role: string;
                status: string;
              };
              model: "invitation";
            };
        onCreateHandle?: string;
        select?: Array<string>;
      },
      any,
      Name
    >;
    deleteMany: FunctionReference<
      "mutation",
      "internal",
      {
        input:
          | {
              model: "user";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "email"
                  | "emailVerified"
                  | "name"
                  | "image"
                  | "createdAt"
                  | "updatedAt"
                  | "twoFactorEnabled"
                  | "isAnonymous"
                  | "username"
                  | "displayUsername"
                  | "phoneNumber"
                  | "phoneNumberVerified"
                  | "userId"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "session";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "userId"
                  | "expiresAt"
                  | "token"
                  | "createdAt"
                  | "updatedAt"
                  | "ipAddress"
                  | "userAgent"
                  | "activeOrganizationId"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "account";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "accountId"
                  | "providerId"
                  | "userId"
                  | "accessToken"
                  | "refreshToken"
                  | "idToken"
                  | "accessTokenExpiresAt"
                  | "refreshTokenExpiresAt"
                  | "scope"
                  | "password"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "verification";
              where?: Array<{
                connector?: "AND" | "OR";
                field: "identifier" | "value" | "expiresAt" | "createdAt" | "updatedAt" | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "organization";
              where?: Array<{
                connector?: "AND" | "OR";
                field: "name" | "slug" | "logo" | "metadata" | "createdAt" | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "member";
              where?: Array<{
                connector?: "AND" | "OR";
                field: "organizationId" | "userId" | "role" | "createdAt" | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "invitation";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "organizationId"
                  | "email"
                  | "role"
                  | "status"
                  | "expiresAt"
                  | "inviterId"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            };
        onDeleteHandle?: string;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
      },
      any,
      Name
    >;
    deleteOne: FunctionReference<
      "mutation",
      "internal",
      {
        input:
          | {
              model: "user";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "email"
                  | "emailVerified"
                  | "name"
                  | "image"
                  | "createdAt"
                  | "updatedAt"
                  | "twoFactorEnabled"
                  | "isAnonymous"
                  | "username"
                  | "displayUsername"
                  | "phoneNumber"
                  | "phoneNumberVerified"
                  | "userId"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "session";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "userId"
                  | "expiresAt"
                  | "token"
                  | "createdAt"
                  | "updatedAt"
                  | "ipAddress"
                  | "userAgent"
                  | "activeOrganizationId"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "account";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "accountId"
                  | "providerId"
                  | "userId"
                  | "accessToken"
                  | "refreshToken"
                  | "idToken"
                  | "accessTokenExpiresAt"
                  | "refreshTokenExpiresAt"
                  | "scope"
                  | "password"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "verification";
              where?: Array<{
                connector?: "AND" | "OR";
                field: "identifier" | "value" | "expiresAt" | "createdAt" | "updatedAt" | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "organization";
              where?: Array<{
                connector?: "AND" | "OR";
                field: "name" | "slug" | "logo" | "metadata" | "createdAt" | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "member";
              where?: Array<{
                connector?: "AND" | "OR";
                field: "organizationId" | "userId" | "role" | "createdAt" | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "invitation";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "organizationId"
                  | "email"
                  | "role"
                  | "status"
                  | "expiresAt"
                  | "inviterId"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            };
        onDeleteHandle?: string;
      },
      any,
      Name
    >;
    findMany: FunctionReference<
      "query",
      "internal",
      {
        join?: any;
        limit?: number;
        model:
          | "user"
          | "session"
          | "account"
          | "verification"
          | "organization"
          | "member"
          | "invitation";
        offset?: number;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
        select?: Array<string>;
        sortBy?: { direction: "asc" | "desc"; field: string };
        where?: Array<{
          connector?: "AND" | "OR";
          field: string;
          operator?:
            | "lt"
            | "lte"
            | "gt"
            | "gte"
            | "eq"
            | "in"
            | "not_in"
            | "ne"
            | "contains"
            | "starts_with"
            | "ends_with";
          value: string | number | boolean | Array<string> | Array<number> | null;
        }>;
      },
      any,
      Name
    >;
    findOne: FunctionReference<
      "query",
      "internal",
      {
        join?: any;
        model:
          | "user"
          | "session"
          | "account"
          | "verification"
          | "organization"
          | "member"
          | "invitation";
        select?: Array<string>;
        where?: Array<{
          connector?: "AND" | "OR";
          field: string;
          operator?:
            | "lt"
            | "lte"
            | "gt"
            | "gte"
            | "eq"
            | "in"
            | "not_in"
            | "ne"
            | "contains"
            | "starts_with"
            | "ends_with";
          value: string | number | boolean | Array<string> | Array<number> | null;
        }>;
      },
      any,
      Name
    >;
    updateMany: FunctionReference<
      "mutation",
      "internal",
      {
        input:
          | {
              model: "user";
              update: {
                createdAt?: number;
                displayUsername?: null | string;
                email?: string;
                emailVerified?: boolean;
                image?: null | string;
                isAnonymous?: null | boolean;
                name?: string;
                phoneNumber?: null | string;
                phoneNumberVerified?: null | boolean;
                twoFactorEnabled?: null | boolean;
                updatedAt?: number;
                userId?: null | string;
                username?: null | string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "email"
                  | "emailVerified"
                  | "name"
                  | "image"
                  | "createdAt"
                  | "updatedAt"
                  | "twoFactorEnabled"
                  | "isAnonymous"
                  | "username"
                  | "displayUsername"
                  | "phoneNumber"
                  | "phoneNumberVerified"
                  | "userId"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "session";
              update: {
                activeOrganizationId?: null | string;
                createdAt?: number;
                expiresAt?: number;
                ipAddress?: null | string;
                token?: string;
                updatedAt?: number;
                userAgent?: null | string;
                userId?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "userId"
                  | "expiresAt"
                  | "token"
                  | "createdAt"
                  | "updatedAt"
                  | "ipAddress"
                  | "userAgent"
                  | "activeOrganizationId"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "account";
              update: {
                accessToken?: null | string;
                accessTokenExpiresAt?: null | number;
                accountId?: string;
                createdAt?: number;
                idToken?: null | string;
                password?: null | string;
                providerId?: string;
                refreshToken?: null | string;
                refreshTokenExpiresAt?: null | number;
                scope?: null | string;
                updatedAt?: number;
                userId?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "accountId"
                  | "providerId"
                  | "userId"
                  | "accessToken"
                  | "refreshToken"
                  | "idToken"
                  | "accessTokenExpiresAt"
                  | "refreshTokenExpiresAt"
                  | "scope"
                  | "password"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "verification";
              update: {
                createdAt?: number;
                expiresAt?: number;
                identifier?: string;
                updatedAt?: number;
                value?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field: "identifier" | "value" | "expiresAt" | "createdAt" | "updatedAt" | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "organization";
              update: {
                createdAt?: number;
                logo?: string;
                metadata?: any;
                name?: string;
                slug?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field: "name" | "slug" | "logo" | "metadata" | "createdAt" | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "member";
              update: {
                createdAt?: number;
                organizationId?: string;
                role?: string;
                userId?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field: "organizationId" | "userId" | "role" | "createdAt" | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "invitation";
              update: {
                email?: string;
                expiresAt?: number;
                inviterId?: string;
                organizationId?: string;
                role?: string;
                status?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "organizationId"
                  | "email"
                  | "role"
                  | "status"
                  | "expiresAt"
                  | "inviterId"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            };
        onUpdateHandle?: string;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
      },
      any,
      Name
    >;
    updateOne: FunctionReference<
      "mutation",
      "internal",
      {
        input:
          | {
              model: "user";
              update: {
                createdAt?: number;
                displayUsername?: null | string;
                email?: string;
                emailVerified?: boolean;
                image?: null | string;
                isAnonymous?: null | boolean;
                name?: string;
                phoneNumber?: null | string;
                phoneNumberVerified?: null | boolean;
                twoFactorEnabled?: null | boolean;
                updatedAt?: number;
                userId?: null | string;
                username?: null | string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "email"
                  | "emailVerified"
                  | "name"
                  | "image"
                  | "createdAt"
                  | "updatedAt"
                  | "twoFactorEnabled"
                  | "isAnonymous"
                  | "username"
                  | "displayUsername"
                  | "phoneNumber"
                  | "phoneNumberVerified"
                  | "userId"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "session";
              update: {
                activeOrganizationId?: null | string;
                createdAt?: number;
                expiresAt?: number;
                ipAddress?: null | string;
                token?: string;
                updatedAt?: number;
                userAgent?: null | string;
                userId?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "userId"
                  | "expiresAt"
                  | "token"
                  | "createdAt"
                  | "updatedAt"
                  | "ipAddress"
                  | "userAgent"
                  | "activeOrganizationId"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "account";
              update: {
                accessToken?: null | string;
                accessTokenExpiresAt?: null | number;
                accountId?: string;
                createdAt?: number;
                idToken?: null | string;
                password?: null | string;
                providerId?: string;
                refreshToken?: null | string;
                refreshTokenExpiresAt?: null | number;
                scope?: null | string;
                updatedAt?: number;
                userId?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "accountId"
                  | "providerId"
                  | "userId"
                  | "accessToken"
                  | "refreshToken"
                  | "idToken"
                  | "accessTokenExpiresAt"
                  | "refreshTokenExpiresAt"
                  | "scope"
                  | "password"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "verification";
              update: {
                createdAt?: number;
                expiresAt?: number;
                identifier?: string;
                updatedAt?: number;
                value?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field: "identifier" | "value" | "expiresAt" | "createdAt" | "updatedAt" | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "organization";
              update: {
                createdAt?: number;
                logo?: string;
                metadata?: any;
                name?: string;
                slug?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field: "name" | "slug" | "logo" | "metadata" | "createdAt" | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "member";
              update: {
                createdAt?: number;
                organizationId?: string;
                role?: string;
                userId?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field: "organizationId" | "userId" | "role" | "createdAt" | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            }
          | {
              model: "invitation";
              update: {
                email?: string;
                expiresAt?: number;
                inviterId?: string;
                organizationId?: string;
                role?: string;
                status?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "organizationId"
                  | "email"
                  | "role"
                  | "status"
                  | "expiresAt"
                  | "inviterId"
                  | "_id";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value: string | number | boolean | Array<string> | Array<number> | null;
              }>;
            };
        onUpdateHandle?: string;
      },
      any,
      Name
    >;
  };
};

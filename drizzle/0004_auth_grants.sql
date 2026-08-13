-- Forward-only repair for databases that applied the RLS baseline before the
-- dedicated Better Auth role existed. Explicit tables keep auth isolated from
-- tenant campaign, contact, mailbox, thread, and analytics data.
GRANT USAGE ON SCHEMA public TO samrian_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "accounts" TO samrian_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "apikeys" TO samrian_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "invitations" TO samrian_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "jwks" TO samrian_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "members" TO samrian_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "organizations" TO samrian_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "organization_roles" TO samrian_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "sessions" TO samrian_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "users" TO samrian_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "verifications" TO samrian_auth;

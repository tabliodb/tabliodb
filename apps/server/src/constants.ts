export enum TabliodbCookie {
  AccessToken = 'tabliodb_access_token',
  AuthType = 'tabliodb_auth_type',
  CsrfToken = 'tabliodb_csrf_token',
  IsAuthenticated = 'tabliodb_is_authenticated',
}

export enum TabliodbHeader {
  ApiKey = 'x-api-key',
  CsrfToken = 'x-csrf-token',
  RequestId = 'x-request-id',
  SessionProofAlgorithm = 'x-tabliodb-session-proof-alg',
  SessionProofKey = 'x-tabliodb-session-proof-key',
  SessionProofNonce = 'x-tabliodb-session-proof-nonce',
  SessionProofSignature = 'x-tabliodb-session-proof-signature',
  SessionProofTimestamp = 'x-tabliodb-session-proof-timestamp',
  SessionToken = 'x-tabliodb-session-token',
  UserToken = 'x-tabliodb-user-token',
}

export enum TabliodbQuery {
  ApiKey = 'apiKey',
  SessionKey = 'sessionKey',
}

export enum AuthType {
  Password = 'password',
  ApiKey = 'api-key',
  Oidc = 'oidc',
}

export enum AuditAction {
  AuthPasswordChanged = 'auth.password_changed',
  AuthPasswordResetCompleted = 'auth.password_reset_completed',
  AuthPasswordResetRequested = 'auth.password_reset_requested',
  InstanceAuthSettingsUpdated = 'instance.auth_settings_updated',
  InstanceOidcSettingsUpdated = 'instance.oidc_settings_updated',
  InstanceSmtpSettingsUpdated = 'instance.smtp_settings_updated',
  OrganizationCreated = 'organization.created',
  OrganizationMemberAdded = 'organization.member_added',
  OrganizationMemberRemoved = 'organization.member_removed',
  OrganizationMemberRoleUpdated = 'organization.member_role_updated',
  OrganizationSettingsUpdated = 'organization.settings_updated',
  ProjectArchived = 'project.archived',
  ProjectCreated = 'project.created',
  ProjectMemberAdded = 'project.member_added',
  ProjectMemberRemoved = 'project.member_removed',
  ProjectMemberRoleUpdated = 'project.member_role_updated',
  TeamArchived = 'team.archived',
  TeamCreated = 'team.created',
  TeamMemberAdded = 'team.member_added',
  TeamMemberRemoved = 'team.member_removed',
  TeamDiagramAccessRemoved = 'team.diagram_access_removed',
  TeamDiagramAccessUpdated = 'team.diagram_access_updated',
  TeamProjectAccessRemoved = 'team.project_access_removed',
  TeamProjectAccessUpdated = 'team.project_access_updated',
  TeamUpdated = 'team.updated',
  CommentDeleted = 'comment.deleted',
  CommentEdited = 'comment.edited',
  CommentThreadReopened = 'comment_thread.reopened',
  CommentThreadResolved = 'comment_thread.resolved',
  DiagramReviewApproved = 'diagram_review.approved',
  DiagramReviewChangesRequested = 'diagram_review.changes_requested',
  DiagramReviewCommented = 'diagram_review.commented',
  DiagramMemberAdded = 'diagram.member_added',
  DiagramMemberRemoved = 'diagram.member_removed',
  DiagramMemberRoleUpdated = 'diagram.member_role_updated',
  DiagramShareLinkCreated = 'diagram_share_link.created',
  DiagramShareLinkRevoked = 'diagram_share_link.revoked',
  UserDisabled = 'user.disabled',
  UserEnabled = 'user.enabled',
  UserPasswordReset = 'user.password_reset',
  UserSessionsRevoked = 'user.sessions_revoked',
}

export enum BackgroundJobType {
  CommentNotificationDelivery = 'comment.notification_delivery',
}

export const SALT_ROUNDS = 12;

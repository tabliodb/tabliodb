export enum TabliodbCookie {
  AccessToken = 'tabliodb_access_token',
  AuthType = 'tabliodb_auth_type',
  CsrfToken = 'tabliodb_csrf_token',
  IsAuthenticated = 'tabliodb_is_authenticated',
}

export enum TabliodbHeader {
  ApiKey = 'x-api-key',
  CsrfToken = 'x-csrf-token',
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
}

export enum AuditAction {
  AuthPasswordResetCompleted = 'auth.password_reset_completed',
  AuthPasswordResetRequested = 'auth.password_reset_requested',
  InstanceAuthSettingsUpdated = 'instance.auth_settings_updated',
  OrganizationMemberRemoved = 'organization.member_removed',
  OrganizationMemberRoleUpdated = 'organization.member_role_updated',
  OrganizationSettingsUpdated = 'organization.settings_updated',
  ProjectArchived = 'project.archived',
  ProjectCreated = 'project.created',
  ProjectMemberAdded = 'project.member_added',
  ProjectMemberRemoved = 'project.member_removed',
  ProjectMemberRoleUpdated = 'project.member_role_updated',
  CommentDeleted = 'comment.deleted',
  CommentEdited = 'comment.edited',
  CommentThreadReopened = 'comment_thread.reopened',
  CommentThreadResolved = 'comment_thread.resolved',
  UserDisabled = 'user.disabled',
  UserEnabled = 'user.enabled',
  UserPasswordReset = 'user.password_reset',
  UserSessionsRevoked = 'user.sessions_revoked',
}

export const SALT_ROUNDS = 12;

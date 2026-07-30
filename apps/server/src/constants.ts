export enum TabliodbCookie {
  AccessToken = 'tabliodb_access_token',
  AuthType = 'tabliodb_auth_type',
  IsAuthenticated = 'tabliodb_is_authenticated',
}

export enum TabliodbHeader {
  ApiKey = 'x-api-key',
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
  OrganizationMemberRemoved = 'organization.member_removed',
  OrganizationMemberRoleUpdated = 'organization.member_role_updated',
  OrganizationSettingsUpdated = 'organization.settings_updated',
  ProjectArchived = 'project.archived',
  ProjectCreated = 'project.created',
  ProjectMemberAdded = 'project.member_added',
  ProjectMemberRemoved = 'project.member_removed',
  ProjectMemberRoleUpdated = 'project.member_role_updated',
  UserDisabled = 'user.disabled',
  UserEnabled = 'user.enabled',
  UserPasswordReset = 'user.password_reset',
  UserSessionsRevoked = 'user.sessions_revoked',
}

export const SALT_ROUNDS = 12;

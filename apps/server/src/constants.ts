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

export const SALT_ROUNDS = 12;

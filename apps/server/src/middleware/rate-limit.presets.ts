import type { RateLimitOptions } from './rate-limit.guard.js';

export const RateLimitPreset = {
  // Auth public endpoints memakai IP bucket karena belum ada user identity yang bisa dipercaya.
  AuthLogin: { key: 'auth:login', limit: 10, windowMs: 60_000 },
  AuthOidcCallback: { key: 'auth:oidc-callback', limit: 60, windowMs: 60_000 },
  AuthOidcStart: { key: 'auth:oidc-start', limit: 20, windowMs: 60_000 },
  AuthLogout: { key: 'auth:logout', limit: 60, windowMs: 60_000 },
  AuthPasswordResetConfirm: { key: 'auth:password-reset-confirm', limit: 10, windowMs: 15 * 60_000 },
  AuthPasswordResetRequest: { key: 'auth:password-reset-request', limit: 5, windowMs: 15 * 60_000 },
  AuthSignUp: { key: 'auth:sign-up', limit: 8, windowMs: 60_000 },

  // Authenticated security mutations memakai user/API-key bucket agar satu user tidak menekan seluruh instance.
  ApiKeyCreate: { key: 'api-keys:create', limit: 10, windowMs: 15 * 60_000 },
  AvatarUpload: { key: 'avatar:upload', limit: 10, windowMs: 15 * 60_000 },
  CurrentPasswordChange: { key: 'auth:password-change', limit: 6, windowMs: 15 * 60_000 },
  // Profile/avatar-delete is low cost but still writes user-owned state, so a relaxed bucket is enough.
  CurrentUserWrite: { key: 'auth:current-user-write', limit: 60, windowMs: 60_000 },

  // Setup dan invitation tetap dibatasi karena keduanya bisa membuat akun/session baru.
  InstanceSettingsWrite: { key: 'instance-settings:write', limit: 20, windowMs: 15 * 60_000 },
  InvitationAccept: { key: 'invitations:accept', limit: 10, windowMs: 15 * 60_000 },
  InvitationCreate: { key: 'invitations:create', limit: 20, windowMs: 60_000 },
  InvitationLookup: { key: 'invitations:lookup', limit: 60, windowMs: 60_000 },
  SetupComplete: { key: 'setup:complete', limit: 5, windowMs: 15 * 60_000 },

  // Editor-heavy operations bisa mahal untuk CPU/DB dan beberapa di antaranya bersifat destructive.
  // Read receipt updates are frequent UI events, so the bucket is intentionally looser than actual comment writes.
  CommentReadStateWrite: { key: 'comments:read-state-write', limit: 120, windowMs: 60_000 },
  CommentWrite: { key: 'comments:write', limit: 24, windowMs: 60_000 },
  DiagramExport: { key: 'diagrams:export', limit: 60, windowMs: 60_000 },
  DiagramImport: { key: 'diagrams:import', limit: 10, windowMs: 15 * 60_000 },
  DiagramReviewAction: { key: 'diagrams:review-action', limit: 30, windowMs: 60_000 },
  // Diagram metadata writes are throttled separately from snapshots because they create or rename resources rather than persist canvas state.
  DiagramWrite: { key: 'diagrams:write', limit: 40, windowMs: 60_000 },
  // Editor preferences can be saved while the app remembers the active workspace/folder/diagram, so this remains permissive.
  EditorPreferenceWrite: { key: 'editor-preferences:write', limit: 120, windowMs: 60_000 },
  // Organization writes affect global access boundaries, so they use a longer window than ordinary editor actions.
  OrganizationWrite: { key: 'organizations:write', limit: 30, windowMs: 15 * 60_000 },
  // Folder writes include member changes; one bucket keeps access-management bursts bounded per user/API key.
  FolderWrite: { key: 'folders:write', limit: 40, windowMs: 60_000 },
  PublicShareRead: { key: 'public-share-link', limit: 120, windowMs: 60_000 },
  // Review signal writes can create noisy audit/history churn, so they are throttled even though permission checks still own authorization.
  ReviewSignalWrite: { key: 'review-signals:write', limit: 30, windowMs: 60_000 },
  ShareLinkWrite: { key: 'share-links:write', limit: 20, windowMs: 15 * 60_000 },
  SnapshotCreate: { key: 'snapshots:create', limit: 20, windowMs: 60_000 },
  SnapshotRestore: { key: 'snapshots:restore', limit: 10, windowMs: 15 * 60_000 },
  // Team writes change indirect folder access, so they share one conservative bucket across team/member/folder-access mutations.
  TeamWrite: { key: 'teams:write', limit: 30, windowMs: 15 * 60_000 },

  // Admin user lifecycle perlu throttle karena aksi ini bisa memengaruhi akses banyak orang.
  UserPasswordReset: { key: 'users:password-reset', limit: 20, windowMs: 15 * 60_000 },
  UserWrite: { key: 'users:write', limit: 30, windowMs: 15 * 60_000 },
} as const satisfies Record<string, RateLimitOptions>;

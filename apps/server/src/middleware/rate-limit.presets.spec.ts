import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AuthController } from '../controllers/auth.controller.js';
import { DiagramShareLinkController } from '../controllers/diagram-share-link.controller.js';
import { DiagramController } from '../controllers/diagram.controller.js';
import { InvitationController } from '../controllers/invitation.controller.js';
import { OrganizationController } from '../controllers/organization.controller.js';
import { ProjectController } from '../controllers/project.controller.js';
import { ReviewSignalController } from '../controllers/review-signal.controller.js';
import { SetupController } from '../controllers/setup.controller.js';
import { SnapshotController } from '../controllers/snapshot.controller.js';
import { TeamController } from '../controllers/team.controller.js';
import { UserController } from '../controllers/user.controller.js';
import { RateLimitPreset } from './rate-limit.presets.js';
import type { RateLimitOptions } from './rate-limit.guard.js';

const rateLimitMetadataKey = 'tabliodb:rate-limit';

describe('rate limit presets', () => {
  it('keeps every preset valid and namespaced with a unique key', () => {
    const presets = Object.values(RateLimitPreset);
    const uniqueKeys = new Set(presets.map((preset) => preset.key));

    expect(uniqueKeys.size).toBe(presets.length);

    for (const preset of presets) {
      // Preset validation catches accidental zero/negative limits before the global guard receives invalid config.
      expect(preset.key).toMatch(/^[a-z0-9:-]+$/);
      expect(preset.limit).toBeGreaterThan(0);
      expect(preset.windowMs).toBeGreaterThan(0);
    }
  });

  it('covers high-risk endpoints that create sessions, mutate access, or rewrite diagram state', () => {
    const cases: Array<{ handler: (...args: never[]) => unknown; preset: RateLimitOptions }> = [
      { handler: AuthController.prototype.login, preset: RateLimitPreset.AuthLogin },
      { handler: AuthController.prototype.signUp, preset: RateLimitPreset.AuthSignUp },
      { handler: AuthController.prototype.updateCurrentUserPassword, preset: RateLimitPreset.CurrentPasswordChange },
      {
        handler: AuthController.prototype.updateCurrentUserTemporaryPassword,
        preset: RateLimitPreset.CurrentPasswordChange,
      },
      { handler: AuthController.prototype.uploadCurrentUserAvatar, preset: RateLimitPreset.AvatarUpload },
      { handler: AuthController.prototype.createApiKey, preset: RateLimitPreset.ApiKeyCreate },
      { handler: AuthController.prototype.revokeApiKey, preset: RateLimitPreset.ApiKeyCreate },
      { handler: SetupController.prototype.complete, preset: RateLimitPreset.SetupComplete },
      { handler: InvitationController.prototype.createInvitation, preset: RateLimitPreset.InvitationCreate },
      { handler: InvitationController.prototype.acceptInvitation, preset: RateLimitPreset.InvitationAccept },
      { handler: OrganizationController.prototype.createOrganization, preset: RateLimitPreset.OrganizationWrite },
      {
        handler: OrganizationController.prototype.updateOrganizationSettings,
        preset: RateLimitPreset.OrganizationWrite,
      },
      { handler: OrganizationController.prototype.updateOrganizationMember, preset: RateLimitPreset.OrganizationWrite },
      { handler: OrganizationController.prototype.removeOrganizationMember, preset: RateLimitPreset.OrganizationWrite },
      { handler: ProjectController.prototype.createProject, preset: RateLimitPreset.ProjectWrite },
      { handler: ProjectController.prototype.updateProject, preset: RateLimitPreset.ProjectWrite },
      { handler: ProjectController.prototype.archiveProject, preset: RateLimitPreset.ProjectWrite },
      { handler: ProjectController.prototype.addProjectMember, preset: RateLimitPreset.ProjectWrite },
      { handler: ProjectController.prototype.updateProjectMember, preset: RateLimitPreset.ProjectWrite },
      { handler: ProjectController.prototype.removeProjectMember, preset: RateLimitPreset.ProjectWrite },
      { handler: TeamController.prototype.createTeam, preset: RateLimitPreset.TeamWrite },
      { handler: TeamController.prototype.updateTeam, preset: RateLimitPreset.TeamWrite },
      { handler: TeamController.prototype.archiveTeam, preset: RateLimitPreset.TeamWrite },
      { handler: TeamController.prototype.addTeamMember, preset: RateLimitPreset.TeamWrite },
      { handler: TeamController.prototype.removeTeamMember, preset: RateLimitPreset.TeamWrite },
      { handler: TeamController.prototype.upsertTeamProjectAccess, preset: RateLimitPreset.TeamWrite },
      { handler: TeamController.prototype.removeTeamProjectAccess, preset: RateLimitPreset.TeamWrite },
      { handler: DiagramController.prototype.createDiagram, preset: RateLimitPreset.DiagramWrite },
      { handler: DiagramController.prototype.updateDiagram, preset: RateLimitPreset.DiagramWrite },
      { handler: DiagramController.prototype.exportDiagram, preset: RateLimitPreset.DiagramExport },
      { handler: DiagramController.prototype.importDiagram, preset: RateLimitPreset.DiagramImport },
      {
        handler: ReviewSignalController.prototype.updateProjectReviewSignalSettings,
        preset: RateLimitPreset.ReviewSignalWrite,
      },
      {
        handler: ReviewSignalController.prototype.updateDiagramReviewSignalSettings,
        preset: RateLimitPreset.ReviewSignalWrite,
      },
      { handler: ReviewSignalController.prototype.ignoreReviewSignal, preset: RateLimitPreset.ReviewSignalWrite },
      { handler: ReviewSignalController.prototype.unignoreReviewSignal, preset: RateLimitPreset.ReviewSignalWrite },
      { handler: SnapshotController.prototype.createSnapshot, preset: RateLimitPreset.SnapshotCreate },
      { handler: SnapshotController.prototype.restoreSnapshot, preset: RateLimitPreset.SnapshotRestore },
      { handler: DiagramShareLinkController.prototype.createDiagramShareLink, preset: RateLimitPreset.ShareLinkWrite },
      { handler: DiagramShareLinkController.prototype.revokeDiagramShareLink, preset: RateLimitPreset.ShareLinkWrite },
      { handler: UserController.prototype.createUser, preset: RateLimitPreset.UserWrite },
      { handler: UserController.prototype.resetUserPassword, preset: RateLimitPreset.UserPasswordReset },
      { handler: UserController.prototype.revokeUserSessions, preset: RateLimitPreset.UserWrite },
    ];
    const reflector = new Reflector();

    for (const item of cases) {
      // Controller metadata is the actual contract consumed by RateLimitGuard at runtime.
      expect(reflector.get<RateLimitOptions>(rateLimitMetadataKey, item.handler)).toEqual(item.preset);
    }
  });
});

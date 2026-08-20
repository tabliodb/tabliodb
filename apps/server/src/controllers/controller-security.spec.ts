import { RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { describe, expect, it } from 'vitest';
import { authMetadataKey } from '../middleware/auth.guard.js';
import { permissionMetadataKey } from '../middleware/permission.guard.js';
import { controllers } from './index.js';

const publicRoutes = new Set([
  'AppController.getHealth',
  'AppController.getLiveness',
  'AppController.getReadiness',
  'AuthController.completeOidcLogin',
  'AuthController.confirmPasswordReset',
  'AuthController.getOidcLoginProvider',
  'AuthController.login',
  'AuthController.requestPasswordReset',
  'AuthController.signUp',
  'AuthController.startOidcLogin',
  'InvitationController.acceptInvitation',
  'InvitationController.getInvitationByToken',
  'PublicShareController.getPublicDiagramShare',
  'SetupController.complete',
  'SetupController.getStatus',
]);

const currentUserScopedRoutes = new Set([
  'AuthController.deleteCurrentUserAvatar',
  'AuthController.getCurrentUserEditorPreference',
  'AuthController.getCurrentUser',
  'AuthController.logout',
  'AuthController.updateCurrentUserEditorPreference',
  'AuthController.updateCurrentUserPassword',
  'AuthController.updateCurrentUserProfile',
  'AuthController.updateCurrentUserTemporaryPassword',
  'AuthController.uploadCurrentUserAvatar',
  'FileController.getFile',
  'NotificationController.getInbox',
  'NotificationController.getSummary',
  'OrganizationController.createOrganization',
]);

const servicePermissionRoutes = new Set([
  'AppController.getMetrics',
  'CommentController.deleteComment',
  'CommentController.getCommentReplies',
  'CommentController.getThreadComments',
  'CommentController.getThreadReadState',
  'CommentController.getThreadRootComments',
  'CommentController.markThreadRead',
  'CommentController.replyToComment',
  'CommentController.replyToThread',
  'CommentController.resolveThread',
  'CommentController.unresolveThread',
  'CommentController.updateComment',
  'InvitationController.createInvitation',
  'ReviewSignalController.ignoreReviewSignal',
  'ReviewSignalController.unignoreReviewSignal',
  'SnapshotController.getSnapshotDiff',
  'SnapshotController.restoreSnapshot',
  'TeamController.addTeamMember',
  'TeamController.archiveTeam',
  'TeamController.createTeam',
  'TeamController.getTeamDiagramAccesses',
  'TeamController.getTeamMembers',
  'TeamController.getTeamProjectAccesses',
  'TeamController.getTeams',
  'TeamController.removeTeamDiagramAccess',
  'TeamController.removeTeamMember',
  'TeamController.removeTeamProjectAccess',
  'TeamController.updateTeam',
  'TeamController.upsertTeamDiagramAccess',
  'TeamController.upsertTeamProjectAccess',
]);

describe('controller security boundaries', () => {
  it('classifies every HTTP route as public, current-user scoped, permission guarded, or service guarded', () => {
    const routes = getControllerRoutes();
    const routeIds = new Set(routes.map((route) => route.id));
    const staleClassifications = [...publicRoutes, ...currentUserScopedRoutes, ...servicePermissionRoutes].filter(
      (routeId) => !routeIds.has(routeId),
    );
    const missingClassifications = routes
      .filter((route) => {
        return (
          !route.hasPermissionMetadata &&
          !publicRoutes.has(route.id) &&
          !currentUserScopedRoutes.has(route.id) &&
          !servicePermissionRoutes.has(route.id)
        );
      })
      .map((route) => route.id);
    const publicRoutesWithAuth = routes
      .filter((route) => publicRoutes.has(route.id) && route.hasAuthMetadata)
      .map((route) => route.id);
    const classifiedAuthenticatedRoutesWithoutAuth = routes
      .filter((route) => {
        return (
          (route.hasPermissionMetadata ||
            currentUserScopedRoutes.has(route.id) ||
            servicePermissionRoutes.has(route.id)) &&
          !route.hasAuthMetadata
        );
      })
      .map((route) => route.id);

    expect(staleClassifications).toEqual([]);
    expect(missingClassifications).toEqual([]);
    expect(publicRoutesWithAuth).toEqual([]);
    expect(classifiedAuthenticatedRoutesWithoutAuth).toEqual([]);
  });
});

function getControllerRoutes() {
  return controllers.flatMap((controller) => {
    const prototype = controller.prototype as unknown as Record<string, unknown>;

    return Object.getOwnPropertyNames(prototype)
      .filter((methodName) => methodName !== 'constructor')
      .map((methodName) => ({
        controller,
        handler: prototype[methodName] as (...args: unknown[]) => unknown,
        methodName,
      }))
      .filter((route) => Reflect.hasMetadata(METHOD_METADATA, route.handler))
      .map((route) => ({
        id: `${route.controller.name}.${route.methodName}`,
        hasAuthMetadata: hasMetadata(authMetadataKey, route.controller, route.handler),
        hasPermissionMetadata: hasMetadata(permissionMetadataKey, route.controller, route.handler),
        method: RequestMethod[Reflect.getMetadata(METHOD_METADATA, route.handler) as RequestMethod],
        path: joinRoutePath(
          Reflect.getMetadata(PATH_METADATA, route.controller) as string | string[] | undefined,
          Reflect.getMetadata(PATH_METADATA, route.handler) as string | string[] | undefined,
        ),
      }));
  });
}

function hasMetadata(
  metadataKey: string,
  controller: Type<unknown>,
  handler: (...args: unknown[]) => unknown,
): boolean {
  // Guards resolve method metadata first and then class metadata; the audit mirrors that lookup so class-level @Authenticated counts.
  return Reflect.hasMetadata(metadataKey, handler) || Reflect.hasMetadata(metadataKey, controller);
}

function joinRoutePath(
  controllerPath: string | string[] | undefined,
  handlerPath: string | string[] | undefined,
): string {
  return [firstPath(controllerPath), firstPath(handlerPath)].filter(Boolean).join('/').replace(/\/+/g, '/');
}

function firstPath(path: string | string[] | undefined): string {
  if (Array.isArray(path)) {
    return path[0] ?? '';
  }

  return path ?? '';
}

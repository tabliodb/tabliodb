import type { RequestOpts } from '@oazapfts/runtime';
import type { LoginResponseDto } from './auth.js';
import type { InstanceAuthSettingsUpdateDto as GeneratedInstanceAuthSettingsUpdateDto } from '../fetch-client.js';
import { completeSetup, getInstanceAuthSettings, getSetupStatus, updateInstanceAuthSettings } from '../fetch-client.js';

export type SignupPolicy = 'allowed_domains' | 'invite_only' | 'public_signup' | 'signup_disabled' | 'sso_only';

export type SetupStatusResponseDto = {
  completedAt: string | null;
  hasOrganization: boolean;
  hasOwner: boolean;
  isSetupComplete: boolean;
  signupPolicy: SignupPolicy;
};

export type SetupCreateDto = {
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
  publicUrl?: string;
  workspaceName: string;
};

export type SetupCreateResponseDto = LoginResponseDto & {
  setup: SetupStatusResponseDto;
};
export type InstanceAuthSettingsDto = {
  allowedDomains: string[];
  signupPolicy: SignupPolicy;
};
export type InstanceAuthSettingsUpdateDto = {
  allowedDomains: string[];
  signupPolicy: SignupPolicy;
};

export type SetupResource = {
  complete: (body: SetupCreateDto) => Promise<SetupCreateResponseDto>;
  getAuthSettings: () => Promise<InstanceAuthSettingsDto>;
  getStatus: () => Promise<SetupStatusResponseDto>;
  updateAuthSettings: (body: InstanceAuthSettingsUpdateDto) => Promise<InstanceAuthSettingsDto>;
};

export function createSetupResource(opts?: RequestOpts): SetupResource {
  return {
    complete: (body: SetupCreateDto) =>
      completeSetup({ setupCreateDto: body }, opts) as Promise<SetupCreateResponseDto>,
    getAuthSettings: () => getInstanceAuthSettings(opts) as Promise<InstanceAuthSettingsDto>,
    getStatus: () => getSetupStatus(opts) as Promise<SetupStatusResponseDto>,
    updateAuthSettings: (body: InstanceAuthSettingsUpdateDto) =>
      updateInstanceAuthSettings(
        { instanceAuthSettingsUpdateDto: body as GeneratedInstanceAuthSettingsUpdateDto },
        opts,
      ) as Promise<InstanceAuthSettingsDto>,
  };
}

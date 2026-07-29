import type { RequestOpts } from '@oazapfts/runtime';
import type { LoginResponseDto } from './auth.js';
import { completeSetup, getSetupStatus } from '../fetch-client.js';

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

export type SetupResource = {
  complete: (body: SetupCreateDto) => Promise<SetupCreateResponseDto>;
  getStatus: () => Promise<SetupStatusResponseDto>;
};

export function createSetupResource(opts?: RequestOpts): SetupResource {
  return {
    complete: (body: SetupCreateDto) =>
      completeSetup({ setupCreateDto: body }, opts) as Promise<SetupCreateResponseDto>,
    getStatus: () => getSetupStatus(opts) as Promise<SetupStatusResponseDto>,
  };
}

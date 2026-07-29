import type { LoginResponseDto } from './auth.js';
import type { TabliodbClient } from '../fetch-client.js';

export type SetupStatusResponseDto = {
  completedAt: string | null;
  hasOrganization: boolean;
  hasOwner: boolean;
  isSetupComplete: boolean;
  signupPolicy: 'signup_disabled' | 'invite_only' | 'allowed_domains' | 'sso_only' | 'public_signup';
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

export function createSetupResource(client: TabliodbClient) {
  return {
    complete: (body: SetupCreateDto) => client.request<SetupCreateResponseDto>('/setup', { body, method: 'POST' }),
    getStatus: () => client.request<SetupStatusResponseDto>('/setup'),
  };
}

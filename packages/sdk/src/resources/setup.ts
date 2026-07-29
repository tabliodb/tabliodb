import type { RequestOpts } from '@oazapfts/runtime';
import type { LoginResponseDto } from './auth.js';
import {
  completeSetup,
  getSetupStatus,
  type SetupCreateDto as GeneratedSetupCreateDto,
  type SetupCreateResponseDtoOutput,
  type SetupStatusResponseDtoOutput,
} from '../fetch-client.js';

export type SetupStatusResponseDto = SetupStatusResponseDtoOutput;

export type SetupCreateDto = GeneratedSetupCreateDto;

export type SetupCreateResponseDto = SetupCreateResponseDtoOutput &
  LoginResponseDto & {
    setup: SetupStatusResponseDto;
  };

export function createSetupResource(opts?: RequestOpts) {
  return {
    complete: (body: SetupCreateDto) =>
      completeSetup({ setupCreateDto: body }, opts) as Promise<SetupCreateResponseDto>,
    getStatus: () => getSetupStatus(opts) as Promise<SetupStatusResponseDto>,
  };
}

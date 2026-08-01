import type { RequestOpts } from '@oazapfts/runtime';
import { getServerHealth } from '../fetch-client.js';

export type ServerDependencyStatus = 'disabled' | 'error' | 'ok';

export type ServerDependencyHealthDto = {
  latencyMs?: number;
  message?: string;
  status: ServerDependencyStatus;
};

export type ServerHealthResponseDto = {
  checkedAt: string;
  dependencies: {
    database: ServerDependencyHealthDto;
    redis: ServerDependencyHealthDto;
  };
  name: string;
  ok: boolean;
  uptimeSeconds: number;
  version: string;
};

export type ServerResource = {
  getHealth: () => Promise<ServerHealthResponseDto>;
};

export function createServerResource(opts?: RequestOpts): ServerResource {
  return {
    // Facade manual menjaga consumer SDK tetap memakai API stabil walaupun generated client berubah struktur.
    getHealth: () => getServerHealth(opts) as Promise<ServerHealthResponseDto>,
  };
}

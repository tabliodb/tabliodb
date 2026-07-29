import { Injectable } from '@nestjs/common';
import { loadEnv, type TabliodbEnv } from '../config/env.js';

@Injectable()
export class ConfigRepository {
  private readonly env: TabliodbEnv = loadEnv();

  getEnv(): TabliodbEnv {
    return this.env;
  }

  isDevelopment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }
}

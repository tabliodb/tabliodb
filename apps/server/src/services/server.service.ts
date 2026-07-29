import { Injectable } from '@nestjs/common';

@Injectable()
export class ServerService {
  getHealth() {
    return {
      ok: true,
      name: 'tabliodb-server',
      version: '0.1.0',
    };
  }
}

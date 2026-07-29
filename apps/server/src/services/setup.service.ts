import { BadRequestException, Injectable } from '@nestjs/common';
import { SALT_ROUNDS } from '../constants.js';
import { SetupCreateDto, SetupCreateResponseDto, SetupStatusResponseDto } from '../dtos/setup.dto.js';
import { ConfigRepository } from '../repositories/config.repository.js';
import { CryptoRepository } from '../repositories/crypto.repository.js';
import { SetupRepository } from '../repositories/setup.repository.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class SetupService {
  constructor(
    private readonly authService: AuthService,
    private readonly configRepository: ConfigRepository,
    private readonly cryptoRepository: CryptoRepository,
    private readonly setupRepository: SetupRepository,
  ) {}

  getStatus(): Promise<SetupStatusResponseDto> {
    return this.setupRepository.getStatus();
  }

  async complete(dto: SetupCreateDto): Promise<SetupCreateResponseDto> {
    const passwordHash = await this.cryptoRepository.hashBcrypt(dto.ownerPassword, SALT_ROUNDS);
    const result = await this.setupRepository.createInitialSetup({
      ownerEmail: dto.ownerEmail.trim().toLowerCase(),
      ownerName: dto.ownerName.trim(),
      ownerPasswordHash: passwordHash,
      publicUrl: dto.publicUrl ?? this.configRepository.getEnv().server.publicUrl,
      workspaceName: dto.workspaceName.trim(),
    });

    if (result.alreadyComplete) {
      throw new BadRequestException('Tabliodb has already been set up');
    }

    const login = await this.authService.createLoginResponse(result.user);

    return {
      ...login,
      setup: result.status,
    };
  }

  getCookieSecureDefault(): boolean {
    return this.authService.getCookieSecureDefault();
  }
}

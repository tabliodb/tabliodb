import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ServerHealthResponseSchema = z
  .object({
    name: z.string(),
    ok: z.boolean(),
    version: z.string(),
  })
  .meta({ id: 'ServerHealthResponseDto' });

export class ServerHealthResponseDto extends createZodDto(ServerHealthResponseSchema) {}

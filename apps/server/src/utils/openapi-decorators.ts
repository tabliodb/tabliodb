import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

export function ApiPaginationQuery() {
  return applyDecorators(
    // Cursor disimpan sebagai opaque string agar strategi pagination bisa diganti tanpa mengubah kontrak endpoint.
    ApiQuery({ name: 'cursor', required: false, type: String }),
    // Limit tetap eksplisit di OpenAPI karena generated SDK membutuhkan tipe query walau DTO sudah divalidasi Zod.
    ApiQuery({ name: 'limit', required: false, type: Number }),
  );
}

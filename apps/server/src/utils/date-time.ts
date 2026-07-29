export function toIsoDateTime(value: Date | string): string {
  // API JSON selalu mengirim date-time sebagai string ISO, meski driver database memberi Date object di runtime server.
  return value instanceof Date ? value.toISOString() : value;
}

export function toNullableIsoDateTime(value: Date | string | null): string | null {
  // Nullable timestamp dipakai untuk state seperti resolvedAt yang belum tentu terjadi.
  return value ? toIsoDateTime(value) : null;
}

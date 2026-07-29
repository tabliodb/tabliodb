import { createTabliodbSdk, type TabliodbSdk } from '@tabliodb/sdk';

export const sdk: TabliodbSdk = createTabliodbSdk({
  baseUrl: '/api',
});

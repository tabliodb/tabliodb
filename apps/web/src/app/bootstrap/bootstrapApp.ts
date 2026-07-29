import { setupQueries } from '@/resources/setup';
import { queryClient } from '@/lib/react-query';

export async function bootstrapApp() {
  document.title = 'Tabliodb';

  try {
    // Setup status adalah keputusan route paling awal; cache dihangatkan sebelum React render agar loader pertama tidak mulai dari nol.
    await queryClient.prefetchQuery(setupQueries.status());
  } catch (error) {
    // Route loader tetap menjadi pemilik error UI supaya startup tidak berhenti di layar kosong saat server belum siap.
    console.warn('Tabliodb bootstrap could not warm setup status:', error);
  }
}

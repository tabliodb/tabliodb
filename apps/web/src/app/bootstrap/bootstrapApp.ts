import '@/services/sdk';
import { setupQueries } from '@/resources/setup';
import { queryClient } from '@/lib/react-query';

export async function bootstrapApp() {
  document.title = 'TablioDB';

  try {
    await queryClient.prefetchQuery(setupQueries.status());
  } catch (error) {
    console.warn('Tabliodb bootstrap could not warm setup status:', error);
  }
}

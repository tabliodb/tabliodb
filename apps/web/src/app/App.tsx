import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditorPage } from '@/features/editor/EditorPage';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <EditorPage />
    </QueryClientProvider>
  );
}

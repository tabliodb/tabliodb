import { RouterProvider } from 'react-router';
import { ReactQueryProvider } from './providers/ReactQueryProvider';
import { router } from './router';

export function App() {
  return (
    <ReactQueryProvider>
      <RouterProvider router={router} />
    </ReactQueryProvider>
  );
}

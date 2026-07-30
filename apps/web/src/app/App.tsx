import { TooltipProvider } from '@tabliodb/ui';
import { RouterProvider } from 'react-router';
import { ReactQueryProvider } from './providers/ReactQueryProvider';
import { router } from './router';

export function App() {
  return (
    <ReactQueryProvider>
      <TooltipProvider delayDuration={250} skipDelayDuration={120}>
        {/* Tooltip provider berada di root agar toolbar, sidebar, dialog, dan admin action memakai timing yang sama. */}
        <RouterProvider router={router} />
      </TooltipProvider>
    </ReactQueryProvider>
  );
}

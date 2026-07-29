import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { App } from './app/App';
import { bootstrapApp } from './app/bootstrap/bootstrapApp';

const root = createRoot(document.getElementById('root')!);

bootstrapApp().finally(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.scss';
import App from './App';
import * as serviceWorker from './serviceWorker';
import 'bootstrap/dist/css/bootstrap.min.css';

/* GLOBAL VARIABLES */

window.$primaryLanguage = 'en';
window.$secondaryLanguage = 'fr';
window.$primaryLanguageIconId = 'primary-lang-icon';
window.$secondaryLanguageIconId = 'secondary-lang-icon';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

serviceWorker.register();


import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations'; // <-- Importa esto

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(), // <-- ¡Esto habilita las animaciones y es clave!
    // ... otros providers, como provideHttpClient() si lo usas
  ]
};
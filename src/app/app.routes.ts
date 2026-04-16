import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/beneficios/beneficios-catalog.component').then(
        m => m.BeneficiosCatalogComponent
      ),
  },
  {
    path: 'sumar-comercio',
    loadComponent: () =>
      import('./pages/sumar-comercio/sumar-comercio.component').then(
        m => m.SumarComercioComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

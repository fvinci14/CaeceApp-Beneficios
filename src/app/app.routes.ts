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
    path: '**',
    redirectTo: '',
  },
];

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-site-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './site-header.component.html',
  styleUrls: ['./site-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteHeaderComponent implements AfterViewInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  mobileMenuOpen = false;
  expandedMobileSection: string | null = null;
  headerHidden = false;
  private lastScrollY = 0;

  readonly sections = [
    {
      id: 'ingresantes',
      label: 'Ingresantes',
      items: [
        { label: 'Documentación requerida', href: 'https://ucaecemdp.edu.ar/desarrollo/informes/' },
        { label: 'Ingreso', href: 'https://ucaecemdp.edu.ar/desarrollo/ingreso/' },
        { label: 'Ingreso Traductor Público', href: 'https://ucaecemdp.edu.ar/desarrollo/curso-de-orientacion/' },
        { label: 'Inscripción online', href: 'https://miucaece.caece.edu.ar/sigedu/SCF/Aplicaciones/index_solicitud_admision.php' },
      ],
    },
    {
      id: 'carreras',
      label: 'Carreras',
      items: [
        { label: 'Lic. en Marketing', href: 'https://ucaecemdp.edu.ar/desarrollo/carreras/licenciatura-en-marketing/' },
        { label: 'Lic. en Administración de Negocios', href: 'https://ucaecemdp.edu.ar/desarrollo/carreras/licenciatura-en-administracion-de-negocios/' },
        { label: 'Lic. en Comercio Internacional', href: 'https://ucaecemdp.edu.ar/desarrollo/carreras/licenciatura-en-comercio-internacional/' },
        { label: 'Contador Público', href: 'https://ucaecemdp.edu.ar/desarrollo/carreras/contador-publico/' },
        { label: 'Lic. en RRPP e Institucionales', href: 'https://ucaecemdp.edu.ar/desarrollo/carreras/licenciatura-en-relaciones-publicas-e-institucionales/' },
        { label: 'Lic. en Publicidad', href: 'https://ucaecemdp.edu.ar/desarrollo/carreras/licenciatura-en-publicidad/' },
        { label: 'Lic. en Diseño Gráfico', href: 'https://ucaecemdp.edu.ar/desarrollo/carreras/licenciatura-en-diseno-grafico-y-comunicacion-audiovisual/' },
        { label: 'Ingeniería en Sistemas', href: 'https://ucaecemdp.edu.ar/desarrollo/carreras/ingenieria-en-sistemas/' },
        { label: 'Lic. en Sistemas', href: 'https://ucaecemdp.edu.ar/desarrollo/carreras/licenciatura-en-sistemas/' },
        { label: 'Traductor Público de Inglés', href: 'https://ucaecemdp.edu.ar/desarrollo/carreras/traductor-publico-de-ingles/' },
      ],
    },
    {
      id: 'universidad',
      label: 'La Universidad',
      items: [
        { label: 'Historia', href: 'https://ucaecemdp.edu.ar/desarrollo/historia/' },
        { label: 'Autoridades', href: 'https://ucaecemdp.edu.ar/desarrollo/autoridades/' },
        { label: 'Sedes', href: 'https://ucaecemdp.edu.ar/desarrollo/sedes/' },
        { label: 'Investigación', href: 'https://ucaecemdp.edu.ar/desarrollo/investigacion/' },
        { label: 'Biblioteca', href: 'https://ucaecemdp.edu.ar/desarrollo/biblioteca/' },
        { label: 'Normas Académicas', href: 'https://ucaecemdp.edu.ar/desarrollo/normas-academicas/' },
        { label: 'Noticias', href: 'https://ucaecemdp.edu.ar/desarrollo/noticias/' },
      ],
    },
    {
      id: 'estudiantes',
      label: 'Estudiantes',
      items: [
        { label: 'Deportes', href: 'https://ucaecemdp.edu.ar/desarrollo/deportes/' },
        { label: 'Calendario Académico', href: 'https://ucaecemdp.edu.ar/desarrollo/calendario-academico/' },
        { label: 'Beneficios', href: 'https://ucaecemdp.edu.ar/desarrollo/beneficios/' },
        { label: 'Bienestar Estudiantil', href: 'https://ucaecemdp.edu.ar/desarrollo/bienestar-estudiantil/' },
        { label: 'Movilidad Educativa', href: 'https://ucaecemdp.edu.ar/desarrollo/movilidad-educativa/' },
        { label: 'Tesorería', href: 'https://ucaecemdp.edu.ar/desarrollo/tesoreria/' },
        { label: 'Contactos útiles', href: 'https://ucaecemdp.edu.ar/desarrollo/contactos-utiles/' },
      ],
    },
  ];

  readonly mobileTopLink = {
    label: 'Contacto',
    href: 'https://ucaecemdp.edu.ar/desarrollo/contacto/',
  };

  readonly mobileExtras = [
    { label: 'Campus Virtual', href: 'https://campus.caece.edu.ar/login/index.php' },
    { label: 'MIUCAECE Autogestión', href: 'https://miucaece.caece.edu.ar/sigedu/Extranet/index.php' },
  ];

  readonly mobileLoginSection = {
    id: 'login-sigedu',
    label: 'Login SIGEDU',
    items: [
      { label: 'Acceso Docentes', href: 'https://miucaece.caece.edu.ar/sigedu/Extranet/index.php' },
      { label: 'Acceso Staff', href: 'https://miucaece.caece.edu.ar/sigedu/Intranet/index.php' },
    ],
  };

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.handleScroll, { passive: true });
    });
  }

  ngOnDestroy() {
    window.removeEventListener('scroll', this.handleScroll);
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    if (!this.mobileMenuOpen) this.expandedMobileSection = null;
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
    this.expandedMobileSection = null;
  }

  toggleMobileSection(id: string) {
    this.expandedMobileSection = this.expandedMobileSection === id ? null : id;
  }

  private handleScroll = () => {
    const currentY = window.scrollY;
    const delta = currentY - this.lastScrollY;
    let nextHidden = this.headerHidden;
    if (currentY < 80) {
      nextHidden = false;
    } else if (delta > 5) {
      nextHidden = true;
    } else if (delta < -5) {
      nextHidden = false;
    }
    this.lastScrollY = currentY;
    if (nextHidden !== this.headerHidden) {
      this.zone.run(() => {
        this.headerHidden = nextHidden;
        this.cdr.markForCheck();
      });
    }
  };
}

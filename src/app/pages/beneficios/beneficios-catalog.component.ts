import { AfterViewInit, Component, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FirestoreService } from '../../services/firestore.service';
import { Place, ICategory, Comercio, CatalogItem } from '../../interfaces/benefit.interface';
import { SiteHeaderComponent } from '../../shared/site-header/site-header.component';
import { SiteFooterComponent } from '../../shared/site-footer/site-footer.component';

declare const google: any;

interface MapPin {
  id: string;
  name: string;
  address: string;
  logo?: string;
  location: { lat: number; lng: number };
}

@Component({
  selector: 'app-beneficios-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SiteHeaderComponent, SiteFooterComponent],
  templateUrl: './beneficios-catalog.component.html',
  styleUrls: ['./beneficios-catalog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BeneficiosCatalogComponent implements OnInit, AfterViewInit {
  private firestoreService = inject(FirestoreService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('statsSection') statsSection?: ElementRef<HTMLElement>;
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLElement>;

  categories: ICategory[] = [];
  items: CatalogItem[] = [];
  selectedCategories: Set<string> = new Set();
  searchTerm = '';
  loading = true;
  categoryMap: Record<string, string> = {};
  categoryIconMap: Record<string, string> = {};
  mapPins: MapPin[] = [];
  showMap = false;
  private mapInstance: any = null;
  private readonly MDP_CENTER = { lat: -38.0055, lng: -57.5426 };
  private readonly BRAND_COLOR = '#33a8b8';
  private logoDataUrl: string | null = null;
  private readonly minimalMapStyles = [
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
  ];

  readonly statsTargets = { community: 4500, activeUsers: 2500 };
  statsDisplay = { community: 0, activeUsers: 0, commerces: 0 };
  private statsAnimated = false;

  get filteredItems(): CatalogItem[] {
    let results = this.items;

    if (this.selectedCategories.size > 0) {
      results = results.filter(i =>
        i.categories?.some(c => this.selectedCategories.has(c))
      );
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      results = results.filter(i =>
        i.name.toLowerCase().includes(term) ||
        i.discount.toLowerCase().includes(term) ||
        (i.subBenefits?.some(sb => sb.discount.toLowerCase().includes(term)) ?? false)
      );
    }

    return results;
  }

  async ngOnInit() {
    try {
      const [allCategories, activeBenefits, comercios] = await Promise.all([
        this.firestoreService.getCollection<ICategory>('categories'),
        this.firestoreService.queryCollection<Place>('benefits', [
          this.firestoreService.createWhereConstraint('isActive', '==', true),
        ]),
        this.firestoreService.getCollection<Comercio>('comercios'),
      ]);

      this.items = this.buildCatalogItems(activeBenefits, comercios);
      this.mapPins = this.buildMapPins(activeBenefits, comercios);

      const usedCategoryIds = new Set(this.items.flatMap(i => i.categories || []));
      this.categories = allCategories.filter(c => c.isActive && usedCategoryIds.has(c.uid));
      this.categoryMap = this.categories.reduce(
        (map, cat) => {
          map[cat.uid] = cat.name;
          return map;
        },
        {} as Record<string, string>
      );
      this.categoryIconMap = this.categories.reduce(
        (map, cat) => {
          if (cat.icon) map[cat.uid] = cat.icon;
          return map;
        },
        {} as Record<string, string>
      );

      const imageUrls = [
        ...this.categories.map(c => c.icon),
        ...this.items.map(i => i.logo),
      ].filter((url): url is string => !!url);
      await this.preloadImages(imageUrls);
    } catch (error) {
      console.error('Error cargando beneficios:', error);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private preloadImages(urls: string[]): Promise<void> {
    if (typeof window === 'undefined' || urls.length === 0) {
      return Promise.resolve();
    }
    const unique = Array.from(new Set(urls));
    return Promise.allSettled(
      unique.map(
        url =>
          new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = url;
          })
      )
    ).then(() => undefined);
  }

  private buildCatalogItems(activeBenefits: Place[], comercios: Comercio[]): CatalogItem[] {
    const activeBenefitsMap = new Map(activeBenefits.map(b => [b.id, b]));
    const assignedIds = new Set(comercios.flatMap(c => c.benefitIds || []));

    const grouped: CatalogItem[] = comercios
      .map((c): CatalogItem | null => {
        const activeBranches = (c.benefitIds || []).filter(id => activeBenefitsMap.has(id));
        if (activeBranches.length === 0) return null;

        let aggregated = (c.subBenefits || []).filter(sb => sb.isActive);
        if (aggregated.length <= 1) {
          const seen = new Set<string>();
          const fromBranches: typeof aggregated = [];
          for (const id of activeBranches) {
            const place = activeBenefitsMap.get(id);
            for (const sb of place?.subBenefits || []) {
              if (!sb.isActive) continue;
              const key = sb.discount.trim().toLowerCase();
              if (seen.has(key)) continue;
              seen.add(key);
              fromBranches.push(sb);
            }
          }
          if (fromBranches.length > aggregated.length) {
            aggregated = fromBranches;
          }
        }

        const item: CatalogItem = {
          id: `c:${c.id}`,
          name: c.name,
          logo: c.logo,
          discount: c.discount,
          categories: c.categories || [],
          branchCount: activeBranches.length,
        };
        if (aggregated.length > 1) {
          item.subBenefits = aggregated;
        }
        return item;
      })
      .filter((x): x is CatalogItem => x !== null);

    const standalone: CatalogItem[] = activeBenefits
      .filter(b => !assignedIds.has(b.id))
      .map(b => {
        const item: CatalogItem = {
          id: `b:${b.id}`,
          name: b.name,
          logo: b.logo,
          discount: b.discount,
          categories: b.categories || [],
          branchCount: 1,
        };
        const activeSubBenefits = (b.subBenefits || []).filter(sb => sb.isActive);
        if (activeSubBenefits.length > 1) {
          item.subBenefits = activeSubBenefits;
        }
        return item;
      });

    return [...grouped, ...standalone].sort((a, b) => a.name.localeCompare(b.name));
  }

  private buildMapPins(activeBenefits: Place[], comercios: Comercio[]): MapPin[] {
    const comercioByBenefitId = new Map<string, Comercio>();
    for (const c of comercios) {
      for (const id of c.benefitIds || []) comercioByBenefitId.set(id, c);
    }
    return activeBenefits
      .filter(b => b.location && Number.isFinite(b.location.lat) && Number.isFinite(b.location.lng))
      .map(b => {
        const comercio = comercioByBenefitId.get(b.id);
        return {
          id: b.id,
          name: comercio?.name ?? b.name,
          address: b.address,
          logo: comercio?.logo ?? b.logo,
          location: b.location as { lat: number; lng: number },
        };
      });
  }

  async openMap() {
    this.showMap = true;
    this.cdr.markForCheck();
    await Promise.all([this.whenGoogleReady(), this.loadLogoDataUrl()]);
    setTimeout(() => this.initMap(), 0);
  }

  private async loadLogoDataUrl(): Promise<void> {
    if (this.logoDataUrl) return;
    try {
      const response = await fetch('assets/images/iso-caece.png');
      const blob = await response.blob();
      this.logoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject();
        reader.readAsDataURL(blob);
      });
    } catch {
      this.logoDataUrl = null;
    }
  }

  private buildPinIconUrl(): string {
    const color = this.BRAND_COLOR;
    const logo = this.logoDataUrl ?? '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
      <path d="M20 2C10.06 2 2 10.06 2 20c0 12.5 18 30 18 30s18-17.5 18-30C38 10.06 29.94 2 20 2z" fill="${color}" stroke="#fff" stroke-width="2"/>
      ${logo ? `<image href="${logo}" x="9" y="9" width="22" height="22" preserveAspectRatio="xMidYMid meet"/>` : `<text x="20" y="26" text-anchor="middle" font-family="Poppins, sans-serif" font-weight="700" font-size="14" fill="#fff">UC</text>`}
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  closeMap() {
    this.showMap = false;
    this.mapInstance = null;
    this.cdr.markForCheck();
  }

  private whenGoogleReady(): Promise<void> {
    return new Promise(resolve => {
      if (typeof google !== 'undefined' && google.maps) return resolve();
      const interval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  private initMap() {
    if (!this.mapContainer) return;
    this.mapInstance = new google.maps.Map(this.mapContainer.nativeElement, {
      center: this.MDP_CENTER,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
      styles: this.minimalMapStyles,
    });

    if (this.mapPins.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    const infoWindow = new google.maps.InfoWindow();
    const icon = {
      url: this.buildPinIconUrl(),
      scaledSize: new google.maps.Size(40, 52),
      anchor: new google.maps.Point(20, 52),
    };

    for (const pin of this.mapPins) {
      const marker = new google.maps.Marker({
        position: pin.location,
        map: this.mapInstance,
        title: pin.name,
        icon,
      });
      bounds.extend(pin.location);
      marker.addListener('click', () => {
        const safeName = this.escapeHtml(pin.name);
        const safeAddress = this.escapeHtml(pin.address || '');
        infoWindow.setContent(
          `<div style="font-family: 'Poppins', sans-serif; max-width: 220px;">
            <strong>${safeName}</strong>
            ${safeAddress ? `<div style="margin-top:4px; color:#555; font-size:0.85em;">${safeAddress}</div>` : ''}
          </div>`
        );
        infoWindow.open(this.mapInstance, marker);
      });
    }

    if (this.mapPins.length === 1) {
      this.mapInstance.setCenter(this.mapPins[0].location);
      this.mapInstance.setZoom(15);
    } else {
      this.mapInstance.fitBounds(bounds, 60);
    }
  }

  private escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c] as string));
  }

  toggleCategory(uid: string) {
    if (this.selectedCategories.has(uid)) {
      this.selectedCategories.delete(uid);
    } else {
      this.selectedCategories.add(uid);
    }
  }

  clearFilters() {
    this.selectedCategories.clear();
    this.searchTerm = '';
  }

  getCategoryNames(categoryIds: string[]): string {
    if (!categoryIds?.length) return '';
    return categoryIds.map(id => this.categoryMap[id] || id).join(', ');
  }

  getCategoryIndex(uid: string): number {
    return this.categories.findIndex(c => c.uid === uid);
  }

  ngAfterViewInit() {
    if (!this.statsSection || !('IntersectionObserver' in window)) {
      this.runStatsAnimation();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.statsAnimated) {
          this.runStatsAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(this.statsSection.nativeElement);
  }

  private runStatsAnimation() {
    if (this.statsAnimated) return;
    this.statsAnimated = true;
    const duration = 1800;
    const start = performance.now();
    const targets = {
      community: this.statsTargets.community,
      activeUsers: this.statsTargets.activeUsers,
      commerces: this.items.length,
    };
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      this.statsDisplay = {
        community: Math.floor(targets.community * ease),
        activeUsers: Math.floor(targets.activeUsers * ease),
        commerces: Math.floor(targets.commerces * ease),
      };
      this.cdr.markForCheck();
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

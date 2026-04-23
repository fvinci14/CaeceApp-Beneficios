import { AfterViewInit, Component, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FirestoreService } from '../../services/firestore.service';
import { Place, ICategory, Comercio, CatalogItem } from '../../interfaces/benefit.interface';

@Component({
  selector: 'app-beneficios-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './beneficios-catalog.component.html',
  styleUrls: ['./beneficios-catalog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BeneficiosCatalogComponent implements OnInit, AfterViewInit {
  private firestoreService = inject(FirestoreService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('statsSection') statsSection?: ElementRef<HTMLElement>;

  categories: ICategory[] = [];
  items: CatalogItem[] = [];
  selectedCategories: Set<string> = new Set();
  searchTerm = '';
  loading = true;
  categoryMap: Record<string, string> = {};

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
        i.discount.toLowerCase().includes(term)
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

      const usedCategoryIds = new Set(this.items.flatMap(i => i.categories || []));
      this.categories = allCategories.filter(c => c.isActive && usedCategoryIds.has(c.uid));
      this.categoryMap = this.categories.reduce(
        (map, cat) => {
          map[cat.uid] = cat.name;
          return map;
        },
        {} as Record<string, string>
      );
    } catch (error) {
      console.error('Error cargando beneficios:', error);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private buildCatalogItems(activeBenefits: Place[], comercios: Comercio[]): CatalogItem[] {
    const activeBenefitsMap = new Map(activeBenefits.map(b => [b.id, b]));
    const assignedIds = new Set(comercios.flatMap(c => c.benefitIds || []));

    const grouped: CatalogItem[] = comercios
      .map(c => {
        const activeBranches = (c.benefitIds || []).filter(id => activeBenefitsMap.has(id));
        if (activeBranches.length === 0) return null;
        return {
          id: `c:${c.id}`,
          name: c.name,
          logo: c.logo,
          discount: c.discount,
          categories: c.categories || [],
          branchCount: activeBranches.length,
        };
      })
      .filter((x): x is CatalogItem => x !== null);

    const standalone: CatalogItem[] = activeBenefits
      .filter(b => !assignedIds.has(b.id))
      .map(b => ({
        id: `b:${b.id}`,
        name: b.name,
        logo: b.logo,
        discount: b.discount,
        categories: b.categories || [],
        branchCount: 1,
      }));

    return [...grouped, ...standalone].sort((a, b) => a.name.localeCompare(b.name));
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

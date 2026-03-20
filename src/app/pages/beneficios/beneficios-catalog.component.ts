import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirestoreService } from '../../services/firestore.service';
import { Place, ICategory } from '../../interfaces/benefit.interface';

@Component({
  selector: 'app-beneficios-catalog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './beneficios-catalog.component.html',
  styleUrls: ['./beneficios-catalog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BeneficiosCatalogComponent implements OnInit {
  private firestoreService = inject(FirestoreService);
  private cdr = inject(ChangeDetectorRef);

  categories: ICategory[] = [];
  benefits: Place[] = [];
  selectedCategory = '';
  loading = true;
  categoryMap: Record<string, string> = {};
  showFormModal = false;

  get filteredBenefits(): Place[] {
    if (!this.selectedCategory) {
      return this.benefits;
    }
    return this.benefits.filter(b => b.categories?.includes(this.selectedCategory));
  }

  async ngOnInit() {
    try {
      const [allCategories, activeBenefits] = await Promise.all([
        this.firestoreService.getCollection<ICategory>('categories'),
        this.firestoreService.queryCollection<Place>('benefits', [
          this.firestoreService.createWhereConstraint('isActive', '==', true),
        ]),
      ]);

      const usedCategoryIds = new Set(activeBenefits.flatMap(b => b.categories || []));
      this.categories = allCategories.filter(c => c.isActive && usedCategoryIds.has(c.uid));
      this.categoryMap = this.categories.reduce(
        (map, cat) => {
          map[cat.uid] = cat.name;
          return map;
        },
        {} as Record<string, string>
      );

      this.benefits = activeBenefits.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error cargando beneficios:', error);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  selectCategory(uid: string) {
    this.selectedCategory = this.selectedCategory === uid ? '' : uid;
  }

  getCategoryNames(categoryIds: string[]): string {
    if (!categoryIds?.length) return '';
    return categoryIds.map(id => this.categoryMap[id] || id).join(', ');
  }
}

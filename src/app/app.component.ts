import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, skip } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-transition" [class.playing]="playing" aria-hidden="true">
      <div class="page-transition-bar"></div>
    </div>
    <router-outlet />
  `,
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  playing = true;
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), skip(1))
      .subscribe(() => this.replay());
  }

  private replay() {
    this.playing = false;
    this.cdr.markForCheck();
    requestAnimationFrame(() => {
      this.playing = true;
      this.cdr.markForCheck();
    });
  }
}

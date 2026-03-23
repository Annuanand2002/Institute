import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'app_theme';
  private themeSubject = new BehaviorSubject<ThemeMode>(this.getStoredTheme());
  public theme$ = this.themeSubject.asObservable();

  constructor() {
    this.applyTheme(this.getStoredTheme());
  }

  private getStoredTheme(): ThemeMode {
    const stored = localStorage.getItem(this.THEME_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    // Default to system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  getTheme(): ThemeMode {
    return this.themeSubject.value;
  }

  setTheme(mode: ThemeMode): void {
    localStorage.setItem(this.THEME_KEY, mode);
    this.themeSubject.next(mode);
    this.applyTheme(mode);
  }

  toggleTheme(): void {
    const newTheme = this.themeSubject.value === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  private applyTheme(mode: ThemeMode): void {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${mode}`);
  }
}

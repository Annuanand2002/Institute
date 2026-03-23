import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

export interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class ShortcutService {
  private shortcuts: Map<string, ShortcutConfig> = new Map();
  private enabled = true;
  private helpSubject = new Subject<void>();
  readonly saveRequested$ = new Subject<void>();

  constructor(
    private router: Router,
    private ngZone: NgZone
  ) {
    this.initGlobalShortcuts();
  }

  help$ = this.helpSubject.asObservable();

  private initGlobalShortcuts(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;
    if (this.isInputFocused(e.target)) {
      if (this.handleInputShortcuts(e)) return;
      return;
    }
    this.dispatch(e);
  }

  private isInputFocused(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    const role = target.getAttribute('role');
    const contentEditable = target.getAttribute('contenteditable') === 'true';
    return (
      tag === 'input' || tag === 'textarea' || tag === 'select' ||
      role === 'textbox' || role === 'searchbox' || contentEditable
    );
  }

  private handleInputShortcuts(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      (e.target as HTMLElement).blur();
      return true;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      this.ngZone.run(() => this.saveRequested$.next());
      return true;
    }
    return false;
  }

  private dispatch(e: KeyboardEvent): void {
    const id = this.getShortcutId(e);
    const config = this.shortcuts.get(id);
    if (config) {
      e.preventDefault();
      e.stopPropagation();
      this.ngZone.run(() => config.action());
    }
  }

  private getShortcutId(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
  }

  registerShortcut(config: Omit<ShortcutConfig, 'key'> & { key: string }): void {
    const parts: string[] = [];
    if (config.ctrlKey || config.metaKey) parts.push('ctrl');
    if (config.shiftKey) parts.push('shift');
    if (config.altKey) parts.push('alt');
    parts.push(config.key.toLowerCase());
    const shortcutId = parts.join('+');
    this.shortcuts.set(shortcutId, config as ShortcutConfig);
  }

  register(id: string, config: ShortcutConfig): void {
    const parts: string[] = [];
    if (config.ctrlKey || config.metaKey) parts.push('ctrl');
    if (config.shiftKey) parts.push('shift');
    if (config.altKey) parts.push('alt');
    parts.push(config.key.toLowerCase());
    const shortcutId = parts.join('+');
    this.shortcuts.set(shortcutId, { ...config, key: config.key });
  }

  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  showHelp(): void {
    this.helpSubject.next();
  }
}

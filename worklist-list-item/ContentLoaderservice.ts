import { Injectable } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, Event } from '@angular/router';
import { BehaviorSubject, delay, map, Observable, startWith } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ContentLoaderService {
    private _loadingCount = new BehaviorSubject<number>(0);
    private _pendingNavigations = new Set<string>();
    isSaving = false;
    
    isLoading$: Observable<boolean> = this._loadingCount.pipe(
        startWith(0),
        delay(0),
        map((count) => count > 0)
    );
    
    constructor(private readonly _router: Router) {
        this._router.events.subscribe((event: Event) => this._handleRouteEvent(event));
    }
    
    show(): void {
        const currentCount = this._loadingCount.getValue();
        this._loadingCount.next(currentCount + 1);
    }
    
    hide(): void {
        const currentCount = this._loadingCount.getValue();
        this._loadingCount.next(currentCount <= 0 ? 0 : currentCount - 1);
    }
    
    /**
     * Track a specific navigation event
     * @param navigationId Unique identifier for this navigation
     */
    trackNavigation(navigationId: string): void {
        this._pendingNavigations.add(navigationId);
        this.show();
    }
    
    /**
     * Clear a tracked navigation event
     * @param navigationId Unique identifier for this navigation
     */
    clearNavigation(navigationId: string): void {
        if (this._pendingNavigations.has(navigationId)) {
            this._pendingNavigations.delete(navigationId);
            this.hide();
        }
    }
    
    /**
     * Clear all pending navigations
     */
    clearAllNavigations(): void {
        if (this._pendingNavigations.size > 0) {
            this._pendingNavigations.clear();
            // Reset the loading count to 0 to ensure we don't have leftover loaders
            this._loadingCount.next(0);
        }
    }
    
    private _handleRouteEvent(event: Event) {
        switch (true) {
            case event instanceof NavigationStart: {
                return this.show();
            }
            
            case event instanceof NavigationEnd:
            case event instanceof NavigationCancel:
            case event instanceof NavigationError: {
                // Ensure we clear all pending navigations when a route event completes
                this.clearAllNavigations();
                return this.hide();
            }
        }
    }
}

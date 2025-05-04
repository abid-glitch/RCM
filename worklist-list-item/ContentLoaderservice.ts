import { Injectable } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, Event } from '@angular/router';
import { BehaviorSubject, delay, map, Observable, startWith } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class ContentLoaderService {
    // public loadingContentSubject = new BehaviorSubject(false);
    // public isLoading$ = this.loadingContentSubject.asObservable();
    // public loaderContent = ''; // 📖 Translation Key

    // setLoaderContent(content = ''): void {
    //     this.loaderContent = content;
    // }

    private _loadingCount = new BehaviorSubject<number>(0);
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

    private _handleRouteEvent(event: Event) {
        switch (true) {
            case event instanceof NavigationStart: {
                return this.show();
            }
            case event instanceof NavigationEnd:
            case event instanceof NavigationCancel:
            case event instanceof NavigationError: {
                return this.hide();
            }
        }
    }
}

import { Component, OnDestroy, OnInit } from '@angular/core';
import { SubComponentService } from 'src/app/shared/services/sub-component.service';
import { VisableComponents } from 'src/app/shared/models';
import { SubcomponentAttributes } from 'src/app/shared/models/ComponentSelectionRules';
import { Subject } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';
import { FeatureFlagService } from '../../shared/services/feature-flag.service';
import { SplitTreatments } from '../../shared/models/SplitTreatment';

@Component({
    selector: 'app-select-components',
    templateUrl: './select-components.component.html',
    styleUrls: ['./select-components.component.scss']
})
export class SelectComponentComponent implements OnInit, OnDestroy {
    subComponents: VisableComponents;
    numberOfSelections: number;

    unSubscribe$ = new Subject<void>();

    getRatingGroup$ = this.subComponentService.selectedRatingGroups$.pipe(
        tap((subComponents) => {
            this.subComponents = subComponents;
        })
    );

    constructor(private subComponentService: SubComponentService, private featureFlagService: FeatureFlagService) {}

    ngOnInit(): void {
        this.initVisibleComponent();

        this.subComponentService.numberOfSelections$
            .pipe(takeUntil(this.unSubscribe$))
            .subscribe((numberOfSelections) => {
                this.numberOfSelections = numberOfSelections;
            });
    }

    get subComponentsPopulated(): VisableComponents {
        return this.subComponents;
    }

    unsorted(a) {
        return a;
    }

    checkboxChanged(componentKey: string, subComponent: SubcomponentAttributes) {
        this.subComponentService.updateComponentSelection(componentKey, subComponent);
    }

    numberOfSelectionsChanged() {
        this.subComponentService.numberOfSelectionsChanged(this.numberOfSelections);
    }

    private initVisibleComponent() {
        if (this.featureFlagService.getTreatmentState(SplitTreatments.ONLINE_RATING_RECOMMENDATION_TABLE)) {
            this.getRatingGroup$.pipe(takeUntil(this.unSubscribe$)).subscribe();
        } else {
            this.subComponentService.visibleComponents$
                .pipe(takeUntil(this.unSubscribe$))
                .subscribe((subComponentsOption) => {
                    this.subComponents = subComponentsOption;
                });
        }
    }

    ngOnDestroy(): void {
        this.unSubscribe$.next();
        this.unSubscribe$.complete();
    }
}

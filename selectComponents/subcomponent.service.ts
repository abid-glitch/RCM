import { BehaviorSubject, defer, of } from 'rxjs';
import { SubcomponentAttributes } from '../models/ComponentSelectionRules';
import { Injectable } from '@angular/core';
import { DataService } from './data.service';
import { VisableComponents } from '../models';
import { filter, map, shareReplay, switchMap } from 'rxjs/operators';
import { RatingRecommendationService } from '../../features/rating-recommendation/services/rating-recommendation.service';
import { FeatureFlagService } from './feature-flag.service';
import { SplitTreatments } from '../models/SplitTreatment';
import { RatingGroupType } from '../models/RatingGroupType';

@Injectable()
export class SubComponentService {
    private DEFAULT_SUB_COMPONENT_TITLE = 'SubComponents';

    private visibleComponentsSubject = new BehaviorSubject<VisableComponents | undefined>(undefined);
    visibleComponents$ = this.visibleComponentsSubject.asObservable();

    numberOfSelections$ = defer(() =>
        of(this.dataService.committeSupportWrapper.componentSelection.numberOfSelections)
    );

    selectedRatingGroups$ = this.dataService.ratingGroupType$.pipe(
        filter((ratingGroupType) => this.allowedRatingGroup(ratingGroupType)),
        switchMap(() => this.dataService.componentSelectionRules$),
        map((visibleComponents) => this.manageComponentSupportRules(visibleComponents)),
        shareReplay({ refCount: false })
    );

    constructor(
        private dataService: DataService,
        private ratingRecommendationService: RatingRecommendationService,
        private featureFlagService: FeatureFlagService
    ) {
        if (!this.isaRatingRecommendationTable()) {
            this.dataService.ratingGroupType$.subscribe(() => {
                this.dataService.getComponentSelection();
                this.visibleComponentsSubject.next(this.dataService.visableComponents);
            });
        }
    }

    updateComponentSelection(component: string, subComponent: SubcomponentAttributes) {
        this.dataService.updateVisableComponents(component, subComponent);
    }

    numberOfSelectionsChanged(numberOfSelections: number) {
        this.dataService.updateNumberOfSelectionsChanged(numberOfSelections);
    }

    private manageComponentSupportRules(componentSelectionRules) {
        for (const component of componentSelectionRules) {
            const allowedRatingGroupComp: SubcomponentAttributes[] =
                component.ratingGroupSelection[this.dataService.committeSupportWrapper.ratingGroupTemplate];
            if (allowedRatingGroupComp) {
                this.dataService.visableComponents[component.componentName] = allowedRatingGroupComp.map(
                    (componentValues) => {
                        const compSubStr = `${component.componentName}${this.DEFAULT_SUB_COMPONENT_TITLE}`;
                        if (!this.dataService.isExistingCase) {
                            this.dataService.updateVisableComponents(component.componentName, componentValues);
                        } else {
                            componentValues.defaultValue =
                                this.dataService.committeSupportWrapper.componentSelection.components[compSubStr][
                                    componentValues.subcomponentName
                                ];
                        }
                        return componentValues;
                    }
                );
            }
        }
        return this.dataService.visableComponents;
    }

    isaRatingRecommendationTable(): boolean {
        return this.featureFlagService.getTreatmentState(SplitTreatments.ONLINE_RATING_RECOMMENDATION_TABLE);
    }

    allowedRatingGroup(ratingGroupType): boolean {
        const figTemplateGroup: RatingGroupType[] = [
            RatingGroupType.BankingFinanceSecurities,
            // RatingGroupType.AssetManagers,
            RatingGroupType.Insurance,
            // RatingGroupType.ClosedEndFunds
            RatingGroupType.NonBanking
        ];
        return figTemplateGroup.includes(ratingGroupType);
    }
}

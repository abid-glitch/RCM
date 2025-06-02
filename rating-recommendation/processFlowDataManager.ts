import { AppRoutes } from '../../../../routes/routes';
import { EntityService } from '../../../services/entity.service';
import { DataService } from '../../../services/data.service';
import { GenerationService } from '../../../services/document-generation.service';
import { RatingRecommendationService } from '../../../../features/rating-recommendation/services/rating-recommendation.service';
import { CasesService, CaseStatus } from '../../../services/cases';
import { exhaustMap, first, tap } from 'rxjs/operators';
import { FeatureFlagService } from '../../../services/feature-flag.service';

export abstract class ProcessFlowDataManager {
    isRatingRecommendation: boolean;
    allowResetToHomePageFlag = false;

    protected constructor(
        public entityService: EntityService,
        public dataService: DataService,
        public generationService: GenerationService,
        public ratingRecommendationService: RatingRecommendationService,
        public casesService: CasesService,
        public featureFlagService: FeatureFlagService
    ) {}

    performSimpleNavigation(navigateTo: AppRoutes) {
        this.casesService.router.navigateByUrl(navigateTo);
    }

    performAppUpdate() {
        if (this.dataService.committeSupportWrapper.id) {
            this.updateExistingCase();
        } else {
            this.createNewCase();
        }
    }

    /*Updates current case and navigates to next page  */
    public updateExistingCase(): void {
        this.dataService
            .manageCaseDetails(CaseStatus.InProgress, this.entityService.selectedOrgTobeImpacted[0]?.name)
            .pipe(
                first(),
                exhaustMap((committeeSupportWrapper) => this.casesService.updateCase(committeeSupportWrapper)),
                tap(() => {
                    this.clearFormDataAndNavigate(AppRoutes.WORK_LIST);
                })
            )
            .subscribe();
    }

    /*Updates current case and navigates to next page  */
    public createNewCase(): void {
        this.dataService
            .manageCaseDetails(CaseStatus.Initiated, this.entityService.selectedOrgTobeImpacted[0]?.name)
            .pipe(
                first(),
                exhaustMap((committeeSupportWrapper) => this.casesService.createCase(committeeSupportWrapper)),
                tap(() => {
                    this.clearFormDataAndNavigate(AppRoutes.WORK_LIST);
                })
            )
            .subscribe();
    }

    clearFormDataAndNavigate(navigateTo: AppRoutes) {
        this.entityService.clearEntitySearchAndFamilyData();
        this.dataService.clearActionSetupPage();
        this.dataService.clearRegulatoryDisclosuresData();
        this.dataService.clearHomePageData();
        this.dataService.clearSmartDefault();
        this.dataService.clearCommitteeSetupPage();
        this.generationService.clearMethodologyFlagsAndSelections();
        this.ratingRecommendationService.resetRatingRecommendationTable();
        this.entityService.isInitialCartSlideCompleted = false;
        if (navigateTo) {
            this.casesService.router.navigateByUrl(navigateTo);
        }
    }
}

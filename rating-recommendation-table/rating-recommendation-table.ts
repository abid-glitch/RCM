import { ChangeDetectorRef, Component, HostBinding, Inject, OnDestroy, OnInit } from '@angular/core';
import { BlueModalRef, BlueModalService, BlueTableData } from '@moodys/blue-ng';
import { RatingRecommendationService } from './services/rating-recommendation.service';
import { AppRoutes } from '../../routes/routes';
import { RatingRecommendationTableView, TableDataLoadingStatus } from './enums/rating-recommendation.enum';
import {
    ActionMenuProp,
    RatingRecommendationUpdatedAction,
    RatingSyncedData,
    SelectedRatingRecommendationEntities
} from './interfaces';
import { NavButtonMetadata } from '../../shared/components/bottom-navbar';
import { RatingGroupType } from '../../shared/models/RatingGroupType';
import { RatingTemplate } from '../../shared/models/RatingTemplate';
import { BehaviorSubject, iif, merge, Observable, of, Subject } from 'rxjs';
import { ContentLoaderService } from '../../shared/services/content-loader.service';
import { distinctUntilChanged, filter, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { NotificationsService } from 'src/app/core/services/notifications.service';
import { CasesService } from '@shared/services/cases';
import { DataService } from '@shared/services/data.service';
import { FeatureFlagService } from '@app/shared/services/feature-flag.service';
import { SplitTreatments } from '@app/shared/models/SplitTreatment';
import { Router } from '@angular/router';
import { RecommendationInputTypes } from './enums';

@Component({
    selector: 'app-rating-recommendation-table',
    templateUrl: './rating-recommendation-table.component.html',
    styleUrls: ['./rating-recommendation-table.component.scss']
})
export class RatingRecommendationTableComponent implements OnInit, OnDestroy {
    @HostBinding('attr.id') role = 'rcmRatingRecommendationPage';

    modalRef: BlueModalRef;
    /* Header component data stream*/
    viewTableBy$ = this.ratingRecommendationService.selectedRatingViewBy$;
    headerDetail$ = this.ratingRecommendationService.ratingRecommendationHeaderDetail$;
    enableActionButton$ = this.ratingRecommendationService.enableGroupActionButton$;
    isFigBanking$ = this.ratingRecommendationService.isFigBankingRatingGroup$;

    ratingRecommendation$ = this.ratingRecommendationService.ratingRecommendationsTableData$;

    recommendationsDropdownOptionMapping$ = this.ratingRecommendationService.getRecommendationsDropdownOptionMapping$;

    warningAndSuccessAlert$ = this.ratingRecommendationService.bulkActionSuccessAndWarningAlert$;

    isLoading$ = this.ratingRecommendationService.tableDataIsLoadingState$.pipe(
        distinctUntilChanged(),
        tap((tableStatus) => {
            if (tableStatus === TableDataLoadingStatus.RetrievingData || tableStatus === '') {
                this.contentLoaderService.show();
            } else {
                this.contentLoaderService.hide();
            }
        })
    );

    private viewChangesSubject$ = new BehaviorSubject<RatingRecommendationTableView | null>(null);

    manageRatingsSyncDirection$: Observable<void> = this.viewChangesSubject$.pipe(
        filter((viewBy) => !!viewBy),
        tap(() => this.ratingRecommendationService.setTableLoadingState('')),
        switchMap(() => this.ratingRecommendationService.allRatingsWithIssuerLevelRatingInDebtView$),

        tap((ratingRecommendationTableMappedResponse) => {
            if (this.viewChangesSubject$.value === RatingRecommendationTableView.Debt) {
                this.ratingRecommendationService.updateSelectionFromClassView(ratingRecommendationTableMappedResponse);
            }
        }),
        switchMap(() =>
            iif(
                () => this.ratingRecommendationService.currentSyncDirection(),
                this.ratingRecommendationService.getSyncedRating(),
                of(null)
            )
        ),
        tap((syncedEntities: RatingSyncedData | null) => {
            this.ratingRecommendationService.changeRatingTableViewBy(this.viewChangesSubject$.value, syncedEntities);
            this.cdrRef.detectChanges();
        }),
        map(() => undefined)
    );

    appRoutes = AppRoutes;
    buttonMetadata!: NavButtonMetadata;
    isFIGTemplateSelected: boolean;
    ratingTemplate = RatingTemplate;
    selectedTemplate = this.ratingRecommendationService.getSelectedTemplate();
    isArfOnly = false;
    updateRatingRecommendation$ = new Subject<BlueTableData>();
    isRatingsTableValid$ = merge(this.ratingRecommendation$, this.updateRatingRecommendation$).pipe(
        map((data) =>
            data.every((table) => {
                return (
                    table.children.filter((row) => !row.data.isSubTableHeader).length === 0 ||
                    table.children
                        .filter((tableRow) => !tableRow.data.isSubTableHeader && tableRow.isSelected)
                        .every(
                            (tableRow) =>
                                (tableRow.data.recommendationInputType === RecommendationInputTypes.OUTLOOK &&
                                    !!tableRow.data.proposedOutlook &&
                                    tableRow.data.proposedOutlook !== 'null') ||
                                (tableRow.data.recommendationInputType !== RecommendationInputTypes.OUTLOOK &&
                                    !!tableRow.data.proposedRating &&
                                    tableRow.data.proposedRating !== 'null')
                        )
                );
            })
        ),
        shareReplay({ bufferSize: 1, refCount: true })
    );

    readonly isRatingCommitteeWorkflow = true
        // this.ratingRecommendationService.getCurrentRatingGroupTemplate() === RatingGroupType.SubSovereign ||
        // this.ratingRecommendationService.getCurrentRatingGroupTemplate() === RatingGroupType.SovereignBond ||
        // this.ratingRecommendationService.getCurrentRatingGroupTemplate() === RatingGroupType.SovereignMDB;
    isCommitteeWorkflow = true
        // this.featureFlagService.getTreatmentState(SplitTreatments.SOV) ||
        // this.featureFlagService.getTreatmentState(SplitTreatments.SOV_MDB) ||
        // this.featureFlagService.getTreatmentState(SplitTreatments.SUB_SOV);

    continueClicked$ = new BehaviorSubject<boolean>(false);

    constructor(
        public ratingRecommendationService: RatingRecommendationService,
        private contentLoaderService: ContentLoaderService,
        private featureFlagService: FeatureFlagService,
        @Inject(BlueModalService) private modalService: BlueModalService,
        public notificationsService: NotificationsService,
        public casesService: CasesService,
        public dataService: DataService,
        public router: Router,
        private cdrRef: ChangeDetectorRef
    ) {}

    ngOnInit() {
        this.isArfOnly = this.dataService.selectedTemplateType == RatingTemplate.Arf;
        this.isFIGTemplateGroup();
        this.setNavButtonMetadata();
        this.ratingRecommendationService.determineDefaultView();
    }

    updateViewTableBy(viewBy: RatingRecommendationTableView): void {
        this.viewChangesSubject$.next(viewBy);
    }

    onSelectedRatingEntity(selectedEntities: SelectedRatingRecommendationEntities) {
        this.ratingRecommendationService.setSelectedRatingRecommendationEntities(selectedEntities);
    }

    onRecommendationChange(recommendation: RatingRecommendationUpdatedAction<Record<string, any>>) {
        this.ratingRecommendationService.updateRecommendation(recommendation);
    }

    onUpdatedRatingRecommendation(recommendation: BlueTableData) {
        this.updateRatingRecommendation$.next(recommendation);
    }

    onContinueClicked() {
        this.continueClicked$.next(true);
    }
    private isFIGTemplateGroup() {
        const figTemplateGroup: RatingGroupType[] = [
            RatingGroupType.BankingFinanceSecurities,
            // RatingGroupType.AssetManagers,
            RatingGroupType.Insurance,
            // RatingGroupType.ClosedEndFunds
            RatingGroupType.NonBanking
        ];
        this.isFIGTemplateSelected = figTemplateGroup.includes(this.ratingRecommendationService.selectedRatingGroup());
    }

    setNavButtonMetadata() {
        this.buttonMetadata = {
            nextButton: {
                buttonLabel: 'navigationControl.saveAndDownload',
                buttonId: 'saveAndDownload'
            },
            prevButton: {
                buttonLabel: 'navigationControl.backLabel',
                buttonId: this.isFIGTemplateSelected ? 'backToComponentSelectionBtnt' : this.setBackButtonId()
            }
        };
        if (this.isCommitteeWorkflow && this.isRatingCommitteeWorkflow) {
            if (this.isArfOnly) {
                this.buttonMetadata.nextButton = {
                    buttonLabel: 'navigationControl.arfDownload',
                    buttonId: 'arfOnlyDownload'
                };
            } else {
                this.buttonMetadata.nextButton = {
                    buttonLabel: 'navigationControl.saveAndContinue',
                    buttonId: 'saveAndContinue'
                };
            }
        }
    }

    setBackButtonId(): string {
        return this.ratingRecommendationService.getSelectedTemplate() === this.ratingTemplate.Arf
            ? 'backToArfBtn'
            : 'backToRcmBtn';
    }

    onBulkActionDispatched(bulkAction: ActionMenuProp<string | number>) {
        this.ratingRecommendationService.onBulkActionReceived(bulkAction);
    }

    ngOnDestroy(): void {
        this.notificationsService.clearNotifications();
    }
}

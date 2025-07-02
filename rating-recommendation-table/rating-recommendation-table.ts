import { ChangeDetectorRef, Component, HostBinding, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
import { BehaviorSubject, combineLatest, iif, merge, Observable, of, Subject } from 'rxjs';
import { ContentLoaderService } from '../../shared/services/content-loader.service';
import { distinctUntilChanged, filter, map, shareReplay, switchMap, takeUntil, tap } from 'rxjs/operators';
import { NotificationsService } from 'src/app/core/services/notifications.service';
import { CasesService, CaseStatus } from '@shared/services/cases';
import { DataService } from '@shared/services/data.service';
import { FeatureFlagService } from '@app/shared/services/feature-flag.service';
import { Router } from '@angular/router';
import { RecommendationInputTypes } from './enums';
import { CustomRatingClassData, CustomRatingClassState } from './models/custom-rating-class-state';
import { Entity } from '@app/shared/models/Entity';
import { EntityService } from '@app/shared/services/entity.service';
import { SplitTreatments } from '@app/shared/models/SplitTreatment';
import _ from 'lodash';
import { UnSavedChanges } from '@app/shared/models/UnSavedChanges';
import { BottomNavbarComponent } from '@app/shared/components/bottom-navbar/bottom-navbar.component';
import { CommitteeSupport } from '@app/shared/models/CommitteeSupport';
import { CommitteePackageApiService } from '@app/close/repository/committee-package-api.service';

@Component({
    selector: 'app-rating-recommendation-table',
    templateUrl: './rating-recommendation-table.component.html',
    styleUrls: ['./rating-recommendation-table.component.scss']
})
export class RatingRecommendationTableComponent implements OnInit, OnDestroy, UnSavedChanges {
    @HostBinding('attr.id') role = 'rcmRatingRecommendationPage';

    modalRef: BlueModalRef;
    /* Header component data stream*/
    viewTableBy$ = this.ratingRecommendationService.selectedRatingViewBy$;
    headerDetail$ = this.ratingRecommendationService.ratingRecommendationHeaderDetail$;
    enableActionButton$ = this.ratingRecommendationService.enableGroupActionButton$;
    enableCustomRatingClassButton$ = this.ratingRecommendationService.enableCustomRatingClassButton$;
    isFigBanking$ = this.ratingRecommendationService.isFigBankingRatingGroup$;
    customRatingClasses$ = this.ratingRecommendationService.customRatingClasses$;
    ratingRecommendation$ = this.ratingRecommendationService.ratingRecommendationsTableData$.pipe(
        filter((ratingRecommendation) => ratingRecommendation.length > 0)
    );

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

    hideCustomRatingClassButton$ = this.viewTableBy$.pipe(
        map((tableView) => tableView !== RatingRecommendationTableView.Class)
    );

    private viewChangesSubject$ = new BehaviorSubject<RatingRecommendationTableView | null>(null);

    manageRatingsSyncDirection$: Observable<void> = this.viewChangesSubject$.pipe(
        filter((viewBy) => !!viewBy),
        tap(() => this.ratingRecommendationService.setTableLoadingState('')),
        switchMap(() => this.ratingRecommendationService.allRatingsWithIssuerLevelRatingInDebtView$),
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
    updateRatingRecommendation$ = new Subject<BlueTableData>();
    countryCode = '';
    countryCeilings: BlueTableData = [];
    isCountryCeilingsEnabled = true;
    caseId: string;
    committeeSupportWrapper: CommitteeSupport;

    ratingRecommendationValidator$ = merge(this.ratingRecommendation$, this.updateRatingRecommendation$);
    customRatingClassesState$ = new BehaviorSubject<Record<string, CustomRatingClassState>>({});

    isRatingsTableValid$ = this.ratingRecommendationValidator$.pipe(
        tap(() => this.cdrRef.detectChanges()),
        map((data) => {
            const tableValidation = data.every((table) => {
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
            });

            return tableValidation;
        }),
        tap(() => this.cdrRef.detectChanges()),
        shareReplay({ bufferSize: 1, refCount: true })
    );

    readonly isRatingCommitteeWorkflow =
        (this.featureFlagService.isCommitteeWorkflowEnabled() &&
            this.ratingRecommendationService.isRatingCommitteeWorkflowEnabled()) ||
        (this.featureFlagService.isCommitteeWorkflowEnabledFIG() &&
            this.ratingRecommendationService.isRatingCommitteeWorkflowEnabledFIG()) ||
        (this.featureFlagService.isCommitteeWorkflowEnabledCFG() &&
            this.ratingRecommendationService.isRatingCommitteeWorkflowEnabledCFG());

    isCommitteeWorkflow = false;

    continueClicked$ = new BehaviorSubject<boolean>(false);
    ratingsMetadataLookup$ = this.ratingRecommendationService.getRatingClasses();
    isRatingRecommendationFlagOn = false;

    isDownloadCompleted$ = this.ratingRecommendationService.isDownloadCompleted$;
    isRatingRecommendationTable = true;

    constructor(
        public ratingRecommendationService: RatingRecommendationService,
        private contentLoaderService: ContentLoaderService,
        private featureFlagService: FeatureFlagService,
        @Inject(BlueModalService) private modalService: BlueModalService,
        public notificationsService: NotificationsService,
        public casesService: CasesService,
        public dataService: DataService,
        public router: Router,
        private cdrRef: ChangeDetectorRef,
        public entityService: EntityService,
        private committeePackageApiService: CommitteePackageApiService
    ) {
        this.isCommitteeWorkflow =
            this.featureFlagService.isCommitteeWorkflowEnabled() ||
            this.featureFlagService.isCommitteeWorkflowEnabledFIG() ||
            this.featureFlagService.isCommitteeWorkflowEnabledCFG();

        this.isRatingRecommendationFlagOn = this.featureFlagService.getTreatmentState(
            SplitTreatments.ONLINE_RATING_RECOMMENDATION_TABLE
        );
        this.setEntities();
    }

    @ViewChild('bottomNavBar') bottomNavbar: BottomNavbarComponent;
    hasUnsavedChanges: boolean;
    discardChanges() {
        this.dataService.committeSupportWrapper.resetEntities();
    }
    saveTable() {
        return this.bottomNavbar.processUpdateCase(CaseStatus.Transitioned);
    }

    setEntities() {
        const selectedEntities: Entity[] = this.getSelectedEntities();

        this.dataService.updateSelectedEntities(selectedEntities);

        if (this.isRatingRecommendationFlagOn) {
            this.ratingRecommendationService.setSelectedTemplate(this.dataService.selectedTemplateType);
            this.ratingRecommendationService.setSelectedEntities(selectedEntities);
        }
    }

    areSelectedCommitteeSupportPropsEqual(initial: CommitteeSupport, current: CommitteeSupport): boolean {
        function pickProps(committeeSupport: CommitteeSupport) {
            return committeeSupport.entities.map(entity => ({
                id: entity.id,
                outlook: (() => {
                    if (!entity.outlook) return entity.outlook;
                    const { proposedOutlook, value } = entity.outlook;
                    const pickedOutlook = { proposedOutlook, value };
                    return pickedOutlook;
                })(),
                ratingClasses: entity.ratingClasses.map(ratingClass => ({
                    ratings: ratingClass.ratings.map(rating => {
                        const data = { ...rating };
                        delete data.refRatings;
                        delete data.ratingClassBadges;
                        return data;
                    })
                })),
                debts: entity.debts.map(debt => ({
                    ratings: debt.ratings.map(debtRating => {
                        const data = { ...debtRating };
                        delete data.refRatings;
                        delete data.ratingClassBadges;
                        return data;
                    })
                }))
            }));
        }
        const initialProps = JSON.parse(JSON.stringify(pickProps(initial)));
        const currentProps = JSON.parse(JSON.stringify(pickProps(current)));
        return _.isEqual(initialProps, currentProps);
    }

    navBackToActionSetupProperties() {
        const initialCommitteeSupport = this.dataService.initialCommitteeSupport;
        const currentCommitteeSupport = this.committeeSupportWrapper;
        let unSubscribe$ = new Subject<void>();
        combineLatest([
            this.ratingRecommendationService.ratingRecommendationsTableData$,
            this.ratingRecommendationService.selectedRatingViewBy$
        ] as [Observable<BlueTableData>, Observable<RatingRecommendationTableView>]).pipe(
            tap(([value, viewBy]: [BlueTableData, RatingRecommendationTableView]) => {
                this.bottomNavbar.removeUnselectedRatingClassesAndDebts(
                    viewBy,
                    this.ratingRecommendationService.selectedRatingRecommendationEntitiesSubject.value,
                    currentCommitteeSupport,
                    value
                );
                if (!this.areSelectedCommitteeSupportPropsEqual(initialCommitteeSupport, currentCommitteeSupport)) {
                    this.hasUnsavedChanges = true;
                } else {
                    this.hasUnsavedChanges = false;
                }
                unSubscribe$.next();
                unSubscribe$.complete();
            }),
            takeUntil(unSubscribe$)
        ).subscribe();
    }

    getSelectedEntities(): Entity[] {
        const selectedEntities: Entity[] = [];
        this.entityService.selectedOrgTobeImpacted.forEach((org) =>
            selectedEntities.push(
                new Entity({
                    id: org.id,
                    name: org.name,
                    type: org.type,
                    analysts: org.analysts,
                    rated: org.rated,
                    category: org.category,
                    domicile: org.domicile,
                    productLineDescription: org.productLineDescription
                } as Entity)
            )
        );
        return selectedEntities;
    }

    ngOnInit() {
        this.committeeSupportWrapper = this.dataService.committeSupportWrapper;
        this.dataService.initialCommitteeSupport = _.cloneDeep(this.committeeSupportWrapper);
        this.caseId = this.committeeSupportWrapper?.id;
        this.isFIGTemplateGroup();
        this.setNavButtonMetadata();
        this.ratingRecommendationService.determineDefaultView();
        this.setDownloadCompleted(false);
        this.loadCountryCeilingData();
    }

    private setDownloadCompleted(isDownloadCompleted: boolean) {
        this.ratingRecommendationService.isDownloadCompleted$.next(isDownloadCompleted);
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
        this.hasUnsavedChanges = false;
    }
    private isFIGTemplateGroup() {
        const figTemplateGroup: RatingGroupType[] = [
            RatingGroupType.BankingFinanceSecurities,
            RatingGroupType.Insurance,
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
    }

    setBackButtonId(): string {
        return this.ratingRecommendationService.getSelectedTemplate() === this.ratingTemplate.Arf
            ? 'backToArfBtn'
            : 'backToRcmBtn';
    }

    onBulkActionDispatched(bulkAction: ActionMenuProp<string | number>) {
        this.ratingRecommendationService.onBulkActionReceived(bulkAction);
    }

    addRatingClass() {
        const addedClasses = this.ratingRecommendationService.onAddRatingClass();
        if (addedClasses.length > 0) {
            const data: Record<string, CustomRatingClassState> = {};
            addedClasses.forEach((addedClass) => {
                data[addedClass.ratingClass.id] = {
                    loading: false,
                    data: null
                };
            });
            this.customRatingClassesState$.next({ ...this.customRatingClassesState$.value, ...data });
        }
    }

    onRatingClassRemoved(identifier: string) {
        const customRatingClassesState = this.customRatingClassesState$.value;
        delete customRatingClassesState[identifier];
        this.customRatingClassesState$.next(customRatingClassesState);
        this.ratingRecommendationService.removeRatingClass(identifier);
    }

    ngOnDestroy(): void {
        this.notificationsService.clearNotifications();
        this.ratingRecommendationService.resetRatingRecommendationTable();
        this.customRatingClassesState$.next({});
    }

    onRatingClassChanged($event: CustomRatingClassData) {
        const data: Record<string, CustomRatingClassState> = {};
        const { identifier, domicile, ratingClassMetadata } = $event;
        if (!ratingClassMetadata.ratingClassName) {
            data[identifier] = {
                loading: false,
                data: null
            };
            this.customRatingClassesState$.next({ ...this.customRatingClassesState$.value, ...data });

            return;
        }

        let loading = true;

        if (ratingClassMetadata.ratingScaleStrategy === RecommendationInputTypes.LDG) {
            loading = false;
        }

        data[identifier] = {
            loading,
            data: {
                identifier,
                domicile,
                ratingClassMetadata
            }
        };
        this.customRatingClassesState$.next({ ...this.customRatingClassesState$.value, ...data });

        if (loading) {
            this.ratingRecommendationService
                .getRatingClassesOptions(
                    ratingClassMetadata.ratingScaleCode,
                    ratingClassMetadata.ratingScaleStrategy,
                    domicile?.code
                )
                .subscribe((ratingScaleMetadata) => {
                    this.ratingRecommendationService.onRatingClassChanged(
                        identifier,
                        ratingClassMetadata,
                        ratingScaleMetadata
                    );
                    data[$event.identifier].loading = false;
                    this.customRatingClassesState$.next({ ...this.customRatingClassesState$.value, ...data });
                });
        } else {
            this.ratingRecommendationService.onRatingClassChanged(identifier, ratingClassMetadata, []);
        }
    }

    loadCountryCeilingData(): void {
        this.committeePackageApiService.getCommitteePackage(this.caseId, null).subscribe((response) => {
            const entities = response.entities;
            const org = entities.find((entity: any) => entity.type === 'ORGANIZATION');
            const domicile = org?.domicile;
            const sovereign = org?.sovereign;

            if (domicile && sovereign) {
                this.countryCeilings = this.getCountryCeilingTableData(sovereign, domicile);
                this.cdrRef.markForCheck();
            }
        });
    }

    private getCountryCeilingTableData(sovereign: any, domicile: any): BlueTableData {
        this.countryCode = domicile?.code;

        return [
            {
                data: {
                    localSovereignRating: this.getRating(sovereign?.ratings || [], 'DOMESTIC'),
                    foreignSovereignRating: this.getRating(sovereign?.ratings || [], 'FOREIGN'),
                    localCountryCeiling: this.getRating(domicile?.ceilings || [], 'DOMESTIC'),
                    foreignCountryCeiling: this.getRating(domicile?.ceilings || [], 'FOREIGN')
                }
            }
        ];
    }

    private getRating(ratings: any[], currency: string): string {
        const rating = ratings.find((r: any) => r.currency === currency);
        return rating ? rating.value : '';
    }
}

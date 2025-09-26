import { ChangeDetectorRef, Component, HostBinding, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { BlueModalRef, BlueModalService, BlueTableData, BlueTableRowData } from '@moodys/blue-ng';
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
import { distinctUntilChanged, filter, map, shareReplay, switchMap, take, tap } from 'rxjs/operators';
import { NotificationsService } from 'src/app/core/services/notifications.service';
import { CasesService, CaseStatus } from '@shared/services/cases';
import { DataService } from '@shared/services/data.service';
import { FeatureFlagService } from '@app/shared/services/feature-flag.service';
import { Router } from '@angular/router';
import { ExcludeMandatoryOutlookRatingClasses, MandatoryOutlookRatingClasses, RecommendationInputTypes } from './enums';
import { CustomRatingClassData, CustomRatingClassState } from './models/custom-rating-class-state';
import { Entity } from '@app/shared/models/Entity';
import { EntityService } from '@app/shared/services/entity.service';
import { SplitTreatments } from '@app/shared/models/SplitTreatment';
import _ from 'lodash';
import { UnSavedChanges } from '@app/shared/models/UnSavedChanges';
import { BottomNavbarComponent } from '@app/shared/components/bottom-navbar/bottom-navbar.component';
import { CommitteeSupport } from '@app/shared/models/CommitteeSupport';
import { CommitteePackageApiService } from '@app/close/repository/committee-package-api.service';
import { CustomDebtData, CustomDebtState } from './models/custom-debt-state';
import { RatingViewType } from '@app/rating-recommendation/enums/entity-rating-type.enum';

@Component({
    selector: 'app-rating-recommendation-table',
    templateUrl: './rating-recommendation-table.component.html',
    styleUrls: ['./rating-recommendation-table.component.scss']
})
export class RatingRecommendationTableComponent implements OnInit, OnDestroy, UnSavedChanges {
    @HostBinding('attr.id') role = 'rcmRatingRecommendationPage';

    preservedDebtSelections: Map<string, boolean> = new Map();

    modalRef: BlueModalRef;
    /* Header component data stream*/
    viewTableBy$ = this.ratingRecommendationService.selectedRatingViewBy$;
    headerDetail$ = this.ratingRecommendationService.ratingRecommendationHeaderDetail$;
    enableActionButton$ = this.ratingRecommendationService.enableGroupActionButton$;
    enableCustomRatingClassButton$ = this.ratingRecommendationService.enableCustomRatingClassButton$;
    enableAddDebtButton$ = this.ratingRecommendationService.enableAddDebtButton$;
    isFigBanking$ = this.ratingRecommendationService.isFigBankingRatingGroup$;
    customRatingClasses$ = this.ratingRecommendationService.customRatingClasses$;
    customDebts$ = this.ratingRecommendationService.customDebts$;
    isInitPreSelection = true;
    private hasInitializedPreSelection = false;
    private isReturningFromSave = false;

    ratingRecommendation$ = this.ratingRecommendationService.ratingRecommendationsTableData$.pipe(
        filter((ratingRecommendation) => ratingRecommendation.length > 0),
        distinctUntilChanged(),
        map((ratingRecommendation) => {
            if (this.isInitPreSelection && !this.hasInitializedPreSelection && !this.isReturningFromSave) {
                ratingRecommendation.forEach((item) => {
                    item.children.forEach((child) => {
                        child.isSelected = !!(
                            child.data.proposedOutlook ||
                            child.data.proposedRating ||
                            child.data.proposedWatchStatus
                        );
                    });
                    item.isSelected = item.children.some((child) => child.isSelected && !child.data.isSubTableHeader);
                });
                this.hasInitializedPreSelection = true;
            }
            return ratingRecommendation;
        })
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
        distinctUntilChanged(),
        tap(() => this.ratingRecommendationService.setTableLoadingState('')),
        switchMap(() => this.ratingRecommendationService.allRatingsWithIssuerLevelRatingInDebtView$.pipe(take(1))),
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
    countryCeilings$: Observable<Array<BlueTableRowData>>;
    caseId: string;
    committeeSupportWrapper: CommitteeSupport;
    isTableViewDisabled = false;
    committeePackage: any;

    ratingRecommendationValidator$ = merge(this.ratingRecommendation$, this.updateRatingRecommendation$);
    customRatingClassesState$ = new BehaviorSubject<Record<string, CustomRatingClassState>>({});
    customDebtsState$ = new BehaviorSubject<Record<string, CustomDebtState>>({});

    isRatingsTableValid$ = this.viewTableBy$.pipe(
        switchMap((viewBy) => {
            if (viewBy === RatingRecommendationTableView.Debt) {
                return this.isDebtTableValid$;
            }

            return this.isClassRatingTableValid$;
        }),
        tap(() => this.cdrRef.detectChanges()),
        shareReplay({ bufferSize: 1, refCount: true })
    );

    private isClassRatingTableValid$ = this.ratingRecommendationValidator$.pipe(
        tap(() => this.cdrRef.detectChanges()),
        map((data) => {
            const tableValidation = data.every((table) => {
                return (
                    table.children.filter((row) => !row.data.isSubTableHeader).length === 0 ||
                    table.children
                        .filter((tableRow) => !tableRow.data.isSubTableHeader && tableRow.isSelected)
                        .every((tableRow) => {
                            const isOutlook =
                                tableRow.data.recommendationInputType === RecommendationInputTypes.OUTLOOK;
                            const hasProposedOutlook =
                                !!tableRow.data.proposedOutlook && tableRow.data.proposedOutlook !== 'null';
                            const hasProposedRating =
                                !!tableRow.data.proposedRating && tableRow.data.proposedRating !== 'null';
                            const mandatoryOutlookRatingClasses = [
                                MandatoryOutlookRatingClasses.LTIssuerRating,
                                MandatoryOutlookRatingClasses.LTBankDeposits,
                                MandatoryOutlookRatingClasses.SeniorUnsecured
                            ];
                            const excludeMandatoryOutlookRatingClasses = [
                                ExcludeMandatoryOutlookRatingClasses.SeniorUnsecuredMTN
                            ];
                            if (
                                this.isFigBanking$.value &&
                                mandatoryOutlookRatingClasses.some((className) =>
                                    tableRow.data.name.includes(className)
                                ) &&
                                !excludeMandatoryOutlookRatingClasses.some((className) =>
                                    tableRow.data.name.includes(className)
                                )
                            ) {
                                return (
                                    (isOutlook && hasProposedOutlook) ||
                                    (!isOutlook && hasProposedRating && hasProposedOutlook)
                                );
                            } else {
                                return (isOutlook && hasProposedOutlook) || (!isOutlook && hasProposedRating);
                            }
                        })
                );
            });

            return tableValidation;
        })
    );

    private isDebtTableValid$ = combineLatest([this.customDebtsState$, this.ratingRecommendationValidator$]).pipe(
        tap(() => this.cdrRef.detectChanges()),
        map(([customDebtsState, data]) => {
            const tableValidation = data.every((table) => {
                return (
                    table.children.filter((row) => !row.data.isSubTableHeader).length === 0 ||
                    table.children
                        .filter((tableRow) => !tableRow.data.isSubTableHeader && tableRow.isSelected)
                        .every((tableRow) => {
                            if (tableRow.data.added) {
                                return (
                                    !!tableRow.data.proposedRating &&
                                    tableRow.data.proposedRating !== 'null' &&
                                    !!customDebtsState[tableRow.data.identifier]?.data?.name
                                );
                            }

                            return (
                                (tableRow.data.recommendationInputType === RecommendationInputTypes.OUTLOOK &&
                                    !!tableRow.data.proposedOutlook &&
                                    tableRow.data.proposedOutlook !== 'null') ||
                                (tableRow.data.recommendationInputType !== RecommendationInputTypes.OUTLOOK &&
                                    !!tableRow.data.proposedRating &&
                                    tableRow.data.proposedRating !== 'null')
                            );
                        })
                );
            });

            return tableValidation;
        })
    );

    readonly isRatingCommitteeWorkflow = this.featureFlagService.isCommitteeWorkflowEnabled(
        this.dataService.committeSupportWrapper
    );

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
        this.ratingRecommendationService.isRatingRecommendationPageLoaded$.next(true);

        this.isCommitteeWorkflow = this.featureFlagService.isCommitteeWorkflowEnabled(
            this.dataService.committeSupportWrapper
        );

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
            return committeeSupport?.entities?.map((entity) => ({
                id: entity.id,
                outlook: (() => {
                    if (!entity.outlook) return entity.outlook;
                    const { proposedOutlook, value } = entity.outlook;
                    const pickedOutlook = { proposedOutlook, value };
                    return pickedOutlook;
                })(),
                ratingClasses:
                    entity?.ratingClasses?.map((ratingClass) => ({
                        ratings: ratingClass.ratings.map((rating) => {
                            const data = { ...rating };
                            delete data.refRatings;
                            delete data.ratingClassBadges;
                            delete data.recommendationInputType;
                            return data;
                        })
                    })) || [],
                debts:
                    entity?.debts?.map((debt) => ({
                        ratings: debt.ratings.map((debtRating) => {
                            const data = { ...debtRating };
                            delete data.refRatings;
                            delete data.ratingClassBadges;
                            delete data.recommendationInputType;
                            return data;
                        })
                    })) || []
            }));
        }
        const initialProps = JSON.parse(JSON.stringify(pickProps(initial)));
        const currentProps = JSON.parse(JSON.stringify(pickProps(current)));

        return _.isEqual(initialProps, currentProps);
    }

    navBackToActionSetupProperties() {
        const initialCommitteeSupport = this.dataService.initialCommitteeSupport;
        const currentCommitteeSupport = this.committeeSupportWrapper;
        const unSubscribe$ = new Subject<void>();
        combineLatest([
            this.ratingRecommendationService.ratingRecommendationsTableData$,
            this.ratingRecommendationService.selectedRatingViewBy$
        ] as [Observable<BlueTableData>, Observable<RatingRecommendationTableView>])
            .pipe(
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
                take(1)
            )
            .subscribe();
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
        this.setCommitteePackage();
    }

    setCommitteePackage() {
        this.committeePackageApiService.getCommitteePackage(this.caseId, null).subscribe((response) => {
            this.committeePackage = response;
            if (this.committeePackage.ratingViewType) {
                this.ratingRecommendationService.changeRatingTableViewBy(
                    this.committeePackage.ratingViewType === 'DEBT'
                        ? RatingRecommendationTableView.Debt
                        : RatingRecommendationTableView.Class,
                    null
                );
            }
            this.isTableViewDisabled = this.committeePackage.canDeleteCommittee === false;
            this.dataService.updateRatingSyncDirection(null);
        });

        this.countryCeilings$ = this.fetchCountryCeilings();
    }

    private fetchCountryCeilings() {
        return combineLatest([
            this.ratingRecommendationService.sovereign$,
            this.ratingRecommendationService.domicile$
        ]).pipe(map(([sovereign, domicile]) => this.getCountryCeilingTableData(sovereign, domicile)));
    }

    private setDownloadCompleted(isDownloadCompleted: boolean) {
        this.ratingRecommendationService.isDownloadCompleted$.next(isDownloadCompleted);
    }

    updateViewTableBy(viewBy: RatingRecommendationTableView): void {
        this.committeeSupportWrapper.ratingViewType =
            viewBy === RatingRecommendationTableView.Class ? RatingViewType.Class : RatingViewType.Debt;

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

    onBulkActionDispatched(bulkAction: ActionMenuProp<string | number>, ratingRecommendation, tableView) {
        const selectedItems = [];
        ratingRecommendation.forEach((item) => {
            selectedItems.push(
                ...item.children.filter((child) => child.isSelected).map((child) => ({ ...child, children: [] }))
            );
        });

        let selectedTableData = { [tableView]: { blueTableData: selectedItems } };
        if (selectedItems && selectedItems.length == 0) {
            selectedTableData = this.ratingRecommendationService.selectedRatingRecommendationEntitiesSubject.value;
        }
        this.ratingRecommendationService.onBulkActionReceived(bulkAction, selectedTableData);
    }

    addRatingClass() {
        this.isInitPreSelection = false;
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

    addDebt() {
        this.isInitPreSelection = false;
        const addedDebts = this.ratingRecommendationService.onAddDebt();
        if (addedDebts.length > 0) {
            const data: Record<string, CustomDebtState> = {};
            addedDebts.forEach((addedDebt) => {
                data[addedDebt.debt.id] = {
                    loading: false,
                    data: null
                };
            });
            this.customDebtsState$.next({ ...this.customDebtsState$.value, ...data });
        }
        this.cdrRef.detectChanges();
    }

    onDebtRemoved(identifier: string) {
        const customDebtsState = this.customDebtsState$.value;
        delete customDebtsState[identifier];
        this.customDebtsState$.next(customDebtsState);
        this.ratingRecommendationService.removeDebt(identifier);
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
        this.customDebtsState$.next({});
        this.ratingRecommendationService.isRatingRecommendationPageLoaded$.next(false);
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

    onDebtChanged($event: CustomDebtData) {
        const data: Record<string, CustomDebtState> = {};
        const {
            entityId,
            identifier,
            domicile,
            ratingClassMetadata,
            name,
            originalFaceAmount,
            currencyCode,
            maturityDate
        } = $event;

        data[identifier] = {
            loading: true,
            data: {
                identifier,
                domicile,
                ratingClassMetadata,

                name,
                originalFaceAmount,
                currencyCode,
                maturityDate,
                entityId
            }
        };

        if (!ratingClassMetadata.ratingClassName) {
            data[identifier] = {
                loading: false,
                data: null
            };
            this.customDebtsState$.next({ ...this.customDebtsState$.value, ...data });
            return;
        }
        data[identifier].loading = true;
        if (ratingClassMetadata.ratingScaleStrategy === RecommendationInputTypes.LDG) {
            data[identifier].loading = false;
        }
        if (
            this.customDebtsState$.value[identifier]?.data?.ratingClassMetadata?.ratingClassName ===
                ratingClassMetadata.ratingClassName &&
            this.customDebtsState$.value[identifier]?.data?.ratingClassMetadata?.ratingScaleCode ===
                ratingClassMetadata.ratingScaleCode &&
            this.customDebtsState$.value[identifier]?.data?.ratingClassMetadata?.ratingScaleStrategy ===
                ratingClassMetadata.ratingScaleStrategy
        ) {
            // Skip update at Rating Recommendation service, update directly Committee Support Wrapper

            data[identifier].loading = false;

            const entity = this.committeeSupportWrapper.entities.find((entity) => entity.id === entityId);
            const debt = entity.debts.find((debt) => debt.id.toString() === identifier.toString());
            debt.name = name;
            debt.originalFaceAmount = +originalFaceAmount;
            debt.outstandingAmount = +originalFaceAmount;
            debt.currencyCode = currencyCode;
            debt.maturityDate = maturityDate;
            this.customDebtsState$.next({ ...this.customDebtsState$.value, ...data });
            return;
        }

        this.customDebtsState$.next({ ...this.customDebtsState$.value, ...data });
        if (data[identifier].loading) {
            this.ratingRecommendationService
                .getRatingClassesOptions(
                    ratingClassMetadata.ratingScaleCode,
                    ratingClassMetadata.ratingScaleStrategy,
                    domicile?.code
                )
                .subscribe((ratingScaleMetadata) => {
                    this.ratingRecommendationService.onDebtChanged(
                        identifier,
                        ratingClassMetadata,
                        ratingScaleMetadata,
                        name,
                        originalFaceAmount,
                        currencyCode,
                        maturityDate
                    );
                    data[$event.identifier].loading = false;
                    this.customDebtsState$.next({ ...this.customDebtsState$.value, ...data });
                });
        } else {
            this.ratingRecommendationService.onDebtChanged(
                identifier,
                ratingClassMetadata,
                [],
                name,
                originalFaceAmount,
                currencyCode,
                maturityDate
            );
        }
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

import { Component, EventEmitter, Injector, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { BlueModalRef, BlueModalService } from '@moodys/blue-ng';
import { CancelConfirmationModalComponent } from 'src/app/features/cancel-confirmation-modal/cancel-confirmation-modal.component';
import { EntityService } from 'src/app/shared/services/entity.service';
import { DataService } from 'src/app/shared/services/data.service';
import { AppRoutes } from 'src/app/routes/routes';
import { NavButtonMetadata } from './interfaces';
import { FeatureFlagService } from '../../services/feature-flag.service';
import { SplitTreatments } from '../../models/SplitTreatment';
import { CasesService, CaseStatus } from '../../services/cases';
import { debounceTime, exhaustMap, filter, finalize, first, switchMap, takeUntil, tap } from 'rxjs/operators';
import { RatingRecommendationService } from '../../../features/rating-recommendation/services/rating-recommendation.service';
import { JapanesePrDisclosurePopupComponent } from '../../../features/japanese-pr-disclosure-popup/japanese-pr-disclosure-popup.component';
import { JapanesePRDisclosure } from '../../models/JapanesePRDisclosure';
import { RatingTemplate } from '../../models/RatingTemplate';
import { GenerationService } from '../../services/document-generation.service';
import { RatingGroupType } from '../../models/RatingGroupType';
import { BehaviorSubject, combineLatest, Observable, ReplaySubject, Subject } from 'rxjs';
import { RatingRecommendationSaveAndDownloadModalComponent } from 'src/app/features/rating-recommendation-save-and-download-modal/rating-recommendation-save-and-download-modal.component';
import { ProcessFlowDataManager } from './helpers/processFlowDataManager';
import { NotificationsService } from 'src/app/core/services/notifications.service';
import { NotificationType } from '../../models/Notification';
import { TranslateService } from '@ngx-translate/core';
import { UserProfileService } from '@app/shared/services/user-profile-service';
import { UserProfile } from '@app/shared/models/UserProfile';
import { RatingRecommendationTableView } from '@app/features/rating-recommendation/enums/rating-recommendation.enum';
import { CommitteeSupport } from '@app/shared/models/CommitteeSupport';
import { SelectedRatingRecommendationEntities } from '@app/features/rating-recommendation';

@Component({
    selector: 'app-bottom-navbar',
    templateUrl: './bottom-navbar.component.html',
    styleUrls: ['./bottom-navbar.component.scss']
})
export class BottomNavbarComponent extends ProcessFlowDataManager implements OnInit, OnDestroy {
    /*Pop up Modals Variable*/
    public modalRef: BlueModalRef;
    private notificationsService: NotificationsService;
    public modalService: BlueModalService;
    public translateService: TranslateService;

    /*Page navigation Variable*/
    @Input() nextPage!: AppRoutes;
    @Input() prevPage!: AppRoutes;
    @Input() navMetaData!: NavButtonMetadata;
    /*Buttons Status Variable*/
    @Input() sectionIsValid = false;
    @Input() isDownloadStage = false;
    @Input() isEntitySelectionSection = false;
    isSaveAction = false;
    isArfDownload = false;
    isArfOnly = false;

    /*Button Actions Emitter Variable*/

    @Output() continueClickedEventEmitter = new EventEmitter<void>();
    @Output() backClickedEventEmitter = new EventEmitter<void>();

    @Input() isRatingsTableValid = false;
    @Input() enableActionButton = false;

    loading$ = new BehaviorSubject<boolean>(false);

    unSubscribe$ = new Subject<void>();

    public isJapaneseDisclosureApplicable: boolean;
    userProfile$: Observable<UserProfile>;
    readonly isRatingCommitteeWorkflow = true
        // this.ratingRecommendationService.getCurrentRatingGroupTemplate() === RatingGroupType.SubSovereign ||
        // this.ratingRecommendationService.getCurrentRatingGroupTemplate() === RatingGroupType.SovereignBond ||
        // this.ratingRecommendationService.getCurrentRatingGroupTemplate() === RatingGroupType.SovereignMDB;
    isCommitteeWorkflow = true
        // this.featureFlagService.getTreatmentState(SplitTreatments.SOV) ||
        // this.featureFlagService.getTreatmentState(SplitTreatments.SOV_MDB) ||
        // this.featureFlagService.getTreatmentState(SplitTreatments.SUB_SOV);

    ratingRecommendation$ = this.ratingRecommendationService.ratingRecommendationsTableData$;

    continueClicked$ = new ReplaySubject<boolean>(1);
    isFinalized = this.dataService.committeSupportWrapper.isFinalized;
    constructor(
        public entityService: EntityService,
        public dataService: DataService,
        public generationService: GenerationService,
        public featureFlagService: FeatureFlagService,
        public ratingRecommendationService: RatingRecommendationService,
        public casesService: CasesService,
        private userProfileService: UserProfileService,
        private injector: Injector
    ) {
        super(
            entityService,
            dataService,
            generationService,
            ratingRecommendationService,
            casesService,
            featureFlagService
        );

        this.notificationsService = injector.get<NotificationsService>(NotificationsService);
        this.modalService = injector.get<BlueModalService>(BlueModalService);
        this.translateService = injector.get<TranslateService>(TranslateService);

        this.userProfile$ = this.userProfileService.userProfile$;
    }

    ngOnInit(): void {
        this.initFeatureFlagValues();
        this.isArfOnly = this.dataService.selectedTemplateType == RatingTemplate.Arf;
        this.isArfDownload =
            this.isRatingCommitteeWorkflow &&
            (this.dataService.selectedTemplateType == RatingTemplate.Arf ||
                this.dataService.selectedTemplateType == RatingTemplate.ArfRcm);

        /*SUBSCRIBE TO DOWNLOAD COMPLETE*/
        this.generationService.downloadComplete$
            .pipe(
                filter(() => this.isRatingRecommendation && !this.allowResetToHomePageFlag),
                tap(() => this.navigateTo()),
                takeUntil(this.unSubscribe$)
            )
            .subscribe();
    }

    private initFeatureFlagValues() {
        this.isRatingRecommendation = this.featureFlagService.getTreatmentState(
            SplitTreatments.ONLINE_RATING_RECOMMENDATION_TABLE
        );

        this.allowResetToHomePageFlag = this.featureFlagService.getTreatmentState(
            SplitTreatments.AFTER_SAVE_AND_DOWNLOAD_DO_NOT_REDIRECT_TO_HOME_SCREEN
        );
    }

    /* Manages actions when cases cancellation is clicked */
    public confirmCancelSelection(): void {
        this.modalRef = this.modalService.open(CancelConfirmationModalComponent, {
            acceptFn: () => {
                this.resetToHomePage();
            },

            dismissFn: () => {
                return;
            }
        });
    }

    handleArfDownload() {
        if (this.dataService.selectedTemplateType == RatingTemplate.ArfRcm) {
            if (this.isDownloadStage && !this.isRatingsTableValid) {
                this.continueClickedEventEmitter.emit();
                this.continueClicked$.next(true);
                return;
            }
            this.handleSaveAndDownload();
        }
    }

    /* Page navigation when continue/saveAndContinue button is clicked */
    confirmContinueSelection(save = true): void {
        if (save && this.isDownloadStage && !this.isRatingsTableValid) {
            this.continueClickedEventEmitter.emit();
            this.continueClicked$.next(true);
            return;
        }

        if (!save || !this.isRatingRecommendation || !this.entityService.selectedOrgTobeImpacted.length) {
            this.handleNavigationForward();
        } else {
            /*Perform Save And Continue*/
            this.saveCurrentWorkProgress();
            this.continueClickedEventEmitter.emit();
            this.continueClicked$.next(true);
        }
    }

    /*Navigates to next page only when the current button action is not Save
     * and continue and then resets loading states
     * */
    navigate(): void {
        if (!this.isSaveAction) {
            if (this.isDownloadStage && !this.isArfOnly && this.isCommitteeWorkflow && this.isRatingCommitteeWorkflow) {
                this.casesService.router.navigate([
                    AppRoutes.CASE,
                    this.dataService.committeSupportWrapper.id,
                    AppRoutes.EXECUTIVE_SUMMARY
                ]);
            } else {
                this.handleNavigationForward();
            }
        }
        this.isSaveAction = false;
    }

    enableButton() {
        this.loading$.next(false);
    }

    /* Manages save actions when the save button is clicked
     * and disables navigation when saving action is being done
     * */
    onClickedSaveButton(): void {
        this.isSaveAction = true;
        this.loading$.next(true);
        this.updateOrCreateNewCase(true);
    }

    /*Manages saving current work progress*/
    saveCurrentWorkProgress(): void {
        if (this.entityService.selectedOrgTobeImpacted.length) {
            if (this.isRatingRecommendation && !this.isDownloadStage) {
                this.handleUpdateOrCreateCase(CaseStatus.InProgress);
            } else if (this.isCommitteeWorkflow && !this.isArfOnly && this.isRatingCommitteeWorkflow) {
                this.handleUpdateOrCreateCase(CaseStatus.Transitioned);
            } else {
                this.handleSaveAndDownload();
            }
        }
    }

    private handleUpdateOrCreateCase(caseStatus: CaseStatus) {
        this.loading$.next(true);
        this.updateOrCreateNewCase(false, caseStatus);
    }

    private handleSaveAndDownload() {
        if (this.checkIfModalIsApplicableForRatingGroup()) {
            this.saveAndDownload();
        } else {
            this.modalRef = this.modalService.open(RatingRecommendationSaveAndDownloadModalComponent, {
                save: this.saveAndDownload.bind(this)
            });
        }
    }

    checkIfModalIsApplicableForRatingGroup() {
        return (
            this.dataService.committeSupportWrapper.ratingGroupTemplate === RatingGroupType.SFGCoveredBonds ||
            this.dataService.committeSupportWrapper.ratingGroupTemplate === RatingGroupType.SFGPrimary ||
            // this.dataService.committeSupportWrapper.ratingGroupTemplate === RatingGroupType.ClosedEndFunds
            this.dataService.committeSupportWrapper.ratingGroupTemplate === RatingGroupType.NonBanking
        );
    }

    /*Manages u[dating or creating new case contingent on if variable committeSupportWrapper has an id*/
    updateOrCreateNewCase(saveButtonClicked = false, caseStatus: CaseStatus = CaseStatus.InProgress): void {
        if (this.dataService.committeSupportWrapper?.id) {
            this.updateCase(caseStatus, saveButtonClicked);
        } else {
            this.createCase();
        }
    }

    /*Create new Case and Navigate to next page*/
    createCase(): void {
        this.dataService.committeSupportWrapper.caseId = this.dataService.generateCaseId();
        this.dataService
            .manageCaseDetails(CaseStatus.Initiated, this.entityService.selectedOrgTobeImpacted[0]?.name)
            .pipe(
                first(),
                exhaustMap((committeeSupportWrapper) => this.casesService.createCase(committeeSupportWrapper)),
                tap((caseCreated) => {
                    this.dataService.setCaseId(caseCreated.id);
                    this.navigate();
                }),
                finalize(() => {
                    this.enableButton();
                })
            )
            .subscribe();
    }

    generateCaseId() {
        let caseId = '';
        let dateTimeSecs = Date.now().toString();
        dateTimeSecs =
            dateTimeSecs.substring(0, 4) +
            '-' +
            dateTimeSecs.substring(4, 8) +
            '-' +
            dateTimeSecs.substring(8, 12) +
            '-' +
            dateTimeSecs.substring(12);

        if (this.dataService.getUserProfiles().size > 0) {
            caseId = this.dataService.getUserProfiles().keys().next().value.toUpperCase() + '-' + dateTimeSecs;
        }
        return caseId;
    }

    /*Updates current case and navigates to next page  */
    updateCase(caseStatus?: CaseStatus, saveButtonClicked = true): void {
        combineLatest([
            this.ratingRecommendationService.selectedRatingViewBy$,
            this.ratingRecommendationService.selectedRatingRecommendationEntities$,
            this.dataService.manageCaseDetails(caseStatus, this.entityService.selectedOrgTobeImpacted[0]?.name)
        ])
            .pipe(
                first(),
                exhaustMap(([viewBy, selectedRatingRecommendationEntities, committeeSupportWrapper]) => {
                    if (this.isCommitteeWorkflow) {
                        /**
                         * @description System should not send unselected checkboxes rating classes and corresponding Debts classes to the RC memo and to the vote page
                         */
                        if (selectedRatingRecommendationEntities.CLASS) {
                            committeeSupportWrapper = this.removeUnselectedRatingClasses(
                                committeeSupportWrapper,
                                selectedRatingRecommendationEntities
                            );
                        }

                        if (
                            viewBy === RatingRecommendationTableView.Debt &&
                            selectedRatingRecommendationEntities.DEBT
                        ) {
                            committeeSupportWrapper = this.removeUnselectedRatingDebts(
                                committeeSupportWrapper,
                                selectedRatingRecommendationEntities
                            );
                        }
                    }
                    return this.casesService.updateCase(committeeSupportWrapper);
                }),
                tap(() => {
                    if (caseStatus === CaseStatus.Canceled) {
                        this.resetToHomePage();
                    } else {
                        this.processToastSaveButton(saveButtonClicked);
                        this.navigate();
                    }
                }),
                finalize(() => {
                    this.enableButton();
                })
            )
            .subscribe();
    }

    public processToastSaveButton(saveButtonClicked: boolean) {
        if (saveButtonClicked) {
            const successMessage = this.translateService.instant('navigationControl.saveToastLabel');
            this.notificationsService.addNotification(
                { message: null, type: NotificationType.SUCCESS },
                null,
                null,
                successMessage
            );
        }
    }

    /*Manages save current case and download document */
    saveAndDownload(): void {
        this.loading$.next(true);
        this.dataService
            .manageCaseDetails(CaseStatus.Completed, this.entityService.selectedOrgTobeImpacted[0]?.name)
            .pipe(
                first(),
                switchMap((committeeSupportWrapper) => this.casesService.updateCase(committeeSupportWrapper)),
                tap(() => {
                    this.onClickDownload();
                }),
                finalize(() => {
                    this.enableButton();
                }),
                debounceTime(120000)
            )
            .subscribe();
    }

    /*Old Implementation For Downloading Document*/
    onClickDownload() {
        if (this.isJapaneseDisclosureApplicable && this.dataService.selectedTemplateType === RatingTemplate.Arf) {
            this.popupJapaneseDisclosure();
        } else {
            this.initiateARFGenerationProcess();
        }
    }

    popupJapaneseDisclosure() {
        this.modalRef = this.modalService.open(JapanesePrDisclosurePopupComponent, {
            onDownload: this.onJapaneseDisclosureConfirmation.bind(this)
        });
    }

    onJapaneseDisclosureConfirmation(selectedOption: JapanesePRDisclosure) {
        this.modalRef.close();
        this.ratingRecommendationService.updateJapaneseDisclosure(selectedOption);
        this.initiateARFGenerationProcess();
    }

    initiateARFGenerationProcess() {
        if (this.isRatingRecommendation) {
            this.generationService.generateDocument(
                this.dataService.selectedTemplateType,
                this.isRatingCommitteeWorkflow,
                this.isCommitteeWorkflow
            );
        } else {
            this.generationService.generateArfRcmDocument(this.dataService.selectedTemplateType);
        }
    }
    /* End of Old Implementation For Downloading Document*/

    /*Manages forward navigation and emit continue event*/
    handleNavigationForward(): void {
        if (this.nextPage) {
            this.casesService.router.navigateByUrl(this.nextPage);
        } else if (
            this.isDownloadStage &&
            !this.isArfOnly &&
            this.isCommitteeWorkflow &&
            this.isRatingCommitteeWorkflow
        ) {
            this.casesService.router.navigate([
                AppRoutes.CASE,
                this.dataService.committeSupportWrapper.id,
                AppRoutes.EXECUTIVE_SUMMARY
            ]);
        }
        this.continueClickedEventEmitter.emit();
    }

    /*Manages back navigation and emit continue event*/
    navBack(): void {
        if (this.prevPage) {
            this.casesService.router.navigateByUrl(this.prevPage);
            this.backClickedEventEmitter.emit();
            this.ratingRecommendationService.onProcessNavigation();
        }
    }

    /* reset state of cases and navigates home */
    private resetToHomePage(): void {
        this.clearFormDataAndNavigate(AppRoutes.WORK_LIST);
    }

    private navigateTo(): void {
        if (this.isArfDownload && !this.isArfOnly && this.isCommitteeWorkflow) {
            return;
        }
        this.resetToHomePage();
    }

    ngOnDestroy(): void {
        this.notificationsService.clearNotifications();
        this.unSubscribe$.next();
        this.unSubscribe$.complete();
    }

    private isSOVTemplateGroup() {
        const sovTemplateGroup: RatingGroupType[] = [
            RatingGroupType.SubSovereign,
            RatingGroupType.SovereignBond,
            RatingGroupType.SovereignMDB
        ];
        return sovTemplateGroup.includes(this.ratingRecommendationService.selectedRatingGroup());
    }

    private removeUnselectedRatingClasses(
        committeeSupportWrapper: CommitteeSupport,
        selectedRatingRecommendationEntities: SelectedRatingRecommendationEntities
    ) {
        committeeSupportWrapper.entities.forEach((entity) => {
            if (entity.ratingClasses) {
                entity.ratingClasses.forEach((ratingClass) => {
                    ratingClass.ratings.forEach((rating) => {
                        const blueTableData = selectedRatingRecommendationEntities.CLASS.blueTableData.find(
                            (el) => el.data.identifier === rating.identifier && el.data.immediateParent.id === entity.id
                        );

                        if (
                            !blueTableData &&
                            !!(rating.proposedOutlook || rating.proposedRating || rating.proposedWatchStatus)
                        ) {
                            rating.proposedOutlook = undefined;
                            rating.proposedRating = undefined;
                            rating.proposedWatchStatus = undefined;
                        }
                    });
                });
            }
            if (entity.outlook) {
                const blueTableData = selectedRatingRecommendationEntities.CLASS.blueTableData.find(
                    (el) => el.data.identifier === entity.outlook.identifier && el.data.immediateParent.id === entity.id
                );
                if (!blueTableData && !!entity.outlook.proposedOutlook) {
                    entity.outlook.proposedOutlook = undefined;
                }
            }
        });

        return committeeSupportWrapper;
    }

    private removeUnselectedRatingDebts(
        committeeSupportWrapper: CommitteeSupport,
        selectedRatingRecommendationEntities: SelectedRatingRecommendationEntities
    ) {
        committeeSupportWrapper.entities.forEach((entity) => {
            if (entity.debts) {
                entity.debts.forEach((debt) => {
                    debt.ratings.forEach((rating) => {
                        const blueTableData = selectedRatingRecommendationEntities.DEBT.blueTableData.find(
                            (el) => el.data.identifier === rating.identifier && el.data.immediateParent.id === entity.id
                        );
                        if (
                            !blueTableData &&
                            !!(rating.proposedOutlook || rating.proposedRating || rating.proposedWatchStatus)
                        ) {
                            rating.proposedOutlook = undefined;
                            rating.proposedRating = undefined;
                            rating.proposedWatchStatus = undefined;
                        }
                    });
                });
            }
            if (entity.outlook) {
                const blueTableData = selectedRatingRecommendationEntities.CLASS.blueTableData.find(
                    (el) => el.data.identifier === entity.outlook.identifier && el.data.immediateParent.id === entity.id
                );
                if (!blueTableData && !!entity.outlook.proposedOutlook) {
                    entity.outlook.proposedOutlook = undefined;
                }
            }
        });
        return committeeSupportWrapper;
    }
}

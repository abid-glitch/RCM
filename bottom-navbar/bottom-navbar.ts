import { ChangeDetectorRef, Component, EventEmitter, Injector, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { BlueModalRef, BlueModalService, BlueTableData } from '@moodys/blue-ng';
import { CancelConfirmationModalComponent } from 'src/app/features/cancel-confirmation-modal/cancel-confirmation-modal.component';
import { EntityService } from 'src/app/shared/services/entity.service';
import { DataService } from 'src/app/shared/services/data.service';
import { AppRoutes } from 'src/app/routes/routes';
import { NavButtonMetadata } from './interfaces';
import { FeatureFlagService } from '../../services/feature-flag.service';
import { SplitTreatments } from '../../models/SplitTreatment';
import { CasesService, CaseStatus } from '../../services/cases';
import {
    debounceTime,
    exhaustMap,
    filter,
    finalize,
    first,
    shareReplay,
    startWith,
    switchMap,
    takeUntil,
    tap
} from 'rxjs/operators';
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
import { Rating, SelectedRatingRecommendationEntities } from '@app/features/rating-recommendation';
import { CommitteeParticipantService } from '@app/participants/repository/services/committee-participant.service';
import { Invitees } from '@app/participants/models/invitees';
import { Router } from '@angular/router';
import { ConflictStatus } from '@app/committee-package/shared/enums/conflict-status';
import _ from 'lodash';
import { RatingRecommendationSaveAndDownloadConfig } from '@app/shared/models/RatingRecommendationSaveAndDownloadConfig';
import { DebtInformationType } from '@app/shared/models/DebtInfomation';

@Component({
    selector: 'app-bottom-navbar',
    templateUrl: './bottom-navbar.component.html',
    styleUrls: ['./bottom-navbar.component.scss']
})
export class BottomNavbarComponent extends ProcessFlowDataManager implements OnInit, OnDestroy, OnDestroy {
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

    /*Button Actions Emitter Variable*/

    @Output() continueClickedEventEmitter = new EventEmitter<void>();
    @Output() backClickedEventEmitter = new EventEmitter<AppRoutes>();

    @Input() isRatingsTableValid = false;
    @Input() enableActionButton = false;
    isSaveEnabled = true;
    @Input() camsId = 0;

    loading$ = new BehaviorSubject<boolean>(false);

    unSubscribe$ = new Subject<void>();

    public isJapaneseDisclosureApplicable: boolean;
    userProfile$: Observable<UserProfile>;
    readonly isRatingCommitteeWorkflow =
        (this.featureFlagService.isCommitteeWorkflowEnabled() &&
            this.ratingRecommendationService.isRatingCommitteeWorkflowEnabled()) ||
        (this.featureFlagService.isCommitteeWorkflowEnabledFIG() &&
            this.ratingRecommendationService.isRatingCommitteeWorkflowEnabledFIG()) ||
        (this.featureFlagService.isCommitteeWorkflowEnabledCFG() &&
            this.ratingRecommendationService.isRatingCommitteeWorkflowEnabledCFG());
    isCommitteeWorkflow = false;

    ratingRecommendation$ = this.ratingRecommendationService.ratingRecommendationsTableData$.pipe(
        startWith([]),
        shareReplay({ bufferSize: 1, refCount: true })
    );

    ratingRecommendationsTableData$ = this.ratingRecommendationService.ratingRecommendationsTableData$;

    continueClicked$ = new ReplaySubject<boolean>(1);
    isFinalized = this.dataService.committeSupportWrapper.isFinalized;
    lastSaveAndDownloadDateExist: boolean;
    currentUrl: string;
    userName: string;

    constructor(
        public entityService: EntityService,
        public dataService: DataService,
        public generationService: GenerationService,
        public featureFlagService: FeatureFlagService,
        public ratingRecommendationService: RatingRecommendationService,
        public casesService: CasesService,
        private userProfileService: UserProfileService,
        private injector: Injector,
        private cdrRef: ChangeDetectorRef,
        private committeeParticipantService: CommitteeParticipantService,
        private router: Router,
        private _userProfileService: UserProfileService
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

        this.dataService
            .getIsSaveClicked()
            .pipe(takeUntil(this.unSubscribe$))
            .subscribe((data) => {
                if (this.currentUrl?.includes(AppRoutes.COMMITTEE_SETUP_PROPERTIES)) {
                    this.isSaveEnabled = !data;
                }
            });

        this._userProfileService.userProfile$.pipe(takeUntil(this.unSubscribe$)).subscribe((data) => {
            if (data) {
                this.userName = data.username;
            }
        });
    }

    ngOnInit(): void {
        this.initFeatureFlagValues();
        this.lastSaveAndDownloadDateExist = !!this.dataService.committeSupportWrapper.lastSaveAndDownloadDate;

        /*SUBSCRIBE TO DOWNLOAD COMPLETE*/
        this.generationService.downloadComplete$
            .pipe(
                filter(() => this.isRatingRecommendation && !this.allowResetToHomePageFlag),
                tap(() => {
                    if (this.isRatingCommitteeWorkflow) {
                        this.navigateTo();
                    }
                }),
                takeUntil(this.unSubscribe$)
            )
            .subscribe();

        this.currentUrl = this.router.url;
    }

    ngOnChange() {
        this.cdrRef.detectChanges();
    }

    private processUpdateCase(caseStatus) {
        return combineLatest([
            this.ratingRecommendationService.selectedRatingViewBy$,
            this.ratingRecommendationService.selectedRatingRecommendationEntities$,
            this.dataService.manageCaseDetails(caseStatus, this.entityService.selectedOrgTobeImpacted[0]?.name),
            this.ratingRecommendationsTableData$
        ]).pipe(
            first(),
            exhaustMap(
                ([
                    viewBy,
                    selectedRatingRecommendationEntities,
                    committeeSupportWrapper,
                    ratingRecommendationsTableData
                ]) => {
                    if (this.isCommitteeWorkflow) {
                        /**
                         * @description System should not send unselected checkboxes rating classes and corresponding Debts classes to the RC memo and to the vote page
                         */
                        if (selectedRatingRecommendationEntities.CLASS) {
                            committeeSupportWrapper = this.removeUnselectedRatingClasses(
                                committeeSupportWrapper,
                                selectedRatingRecommendationEntities,
                                ratingRecommendationsTableData
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
                    return this.casesService.updateCase(committeeSupportWrapper).pipe(
                        tap(() => {
                            this.dataService.committeSupportWrapper.updateEntities(committeeSupportWrapper.entities);
                        })
                    );
                }
            ),
            takeUntil(this.unSubscribe$)
        );
    }

    private initFeatureFlagValues() {
        this.isRatingRecommendation = this.featureFlagService.getTreatmentState(
            SplitTreatments.ONLINE_RATING_RECOMMENDATION_TABLE
        );

        this.allowResetToHomePageFlag = this.featureFlagService.getTreatmentState(
            SplitTreatments.AFTER_SAVE_AND_DOWNLOAD_DO_NOT_REDIRECT_TO_HOME_SCREEN
        );
        this.isCommitteeWorkflow =
            this.featureFlagService.isCommitteeWorkflowEnabled() ||
            this.featureFlagService.isCommitteeWorkflowEnabledFIG() ||
            this.featureFlagService.isCommitteeWorkflowEnabledCFG();
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

    /* Page navigation when continue/saveAndContinue button is clicked */
    confirmContinueSelection(save = true): void {
        if (!this.currentUrl.includes(AppRoutes.COMMITTEE_SETUP_PROPERTIES)) {
            this.controlNavigation(save);
        } else {
            this.dataService.setIsSaveClicked(true);
            this.committeeParticipantService
                .getCamsParticipants(this.camsId.toString())
                .pipe(takeUntil(this.unSubscribe$))
                .subscribe({
                    next: (data) => {
                        if (data?.invitees) {
                            this.isSaveEnabled = this.checkParticipants(data.invitees);
                            if (!this.isSaveEnabled) {
                                this.dataService.setIsCamsIDInvalid(true);
                            }
                        }

                        if (this.isSaveEnabled) {
                            this.controlNavigation(save);
                            this.dataService.setIsCamsIDInvalid(false);
                        } else {
                            this.dataService.setIsCamsIDInvalid(true);
                        }
                    },
                    error: () => {
                        this.dataService.setIsCamsIDInvalid(true);
                    }
                });
        }
    }
    checkParticipants(participants: Invitees[]): boolean {
        const isValid = participants.some(
            (participant) =>
                participant.userName?.toLowerCase() === this.userName &&
                participant.participantStatus === ConflictStatus.Eligible
        );
        return isValid;
    }

    controlNavigation(save) {
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
            if (this.isDownloadStage && this.isRatingCommitteeWorkflow) {
                this.onClickDownload();
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
        if (this.currentUrl?.includes(AppRoutes.COMMITTEE_SETUP_PROPERTIES)) {
            this.dataService.initialCommitteeSupport = _.cloneDeep(
                this.dataService.committeSupportWrapper
            );
        }
        this.updateOrCreateNewCase(true);
    }

    /*Manages saving current work progress*/
    saveCurrentWorkProgress(): void {
        if (this.entityService.selectedOrgTobeImpacted.length) {
            if (this.isRatingRecommendation && !this.isDownloadStage) {
                this.handleUpdateOrCreateCase(CaseStatus.InProgress);
            } else {
                if (this.checkIfModalIsApplicableForRatingGroup()) {
                    this.saveAndDownload();
                } else {
                    this.modalRef = this.modalService.open(RatingRecommendationSaveAndDownloadModalComponent, {
                        save: (config: RatingRecommendationSaveAndDownloadConfig) => this.saveAndDownload(config)
                    });
                }
            }
        }
    }

    private handleUpdateOrCreateCase(caseStatus: CaseStatus) {
        this.loading$.next(true);
        this.updateOrCreateNewCase(false, caseStatus);
    }

    checkIfModalIsApplicableForRatingGroup() {
        return (
            this.dataService.committeSupportWrapper.ratingGroupTemplate === RatingGroupType.SFGCoveredBonds ||
            this.dataService.committeSupportWrapper.ratingGroupTemplate === RatingGroupType.SFGPrimary ||
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
    updateCase(caseStatus?: CaseStatus, saveButtonClicked = false): void {
        caseStatus = this.dataService.committeSupportWrapper.status ? this.dataService.committeSupportWrapper.status : caseStatus;
        this.processUpdateCase(caseStatus)
            .pipe(
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
    saveAndDownload(config?: RatingRecommendationSaveAndDownloadConfig): void {
        this.loading$.next(true);
        const caseStatus = this.isRatingCommitteeWorkflow ? CaseStatus.Transitioned : CaseStatus.Completed;
        this.dataService
            .manageCaseDetails(caseStatus, this.entityService.selectedOrgTobeImpacted[0]?.name)
            .pipe(
                first(),
                tap((committeeSupportWrapper) => {
                    if (this.isRatingCommitteeWorkflow) {
                        committeeSupportWrapper.lastSaveAndDownloadDate = new Date(new Date().toISOString());
                    }
                }),
                switchMap(() => this.processUpdateCase(caseStatus)),
                tap(() => {
                    this.onClickDownload(config);
                }),
                tap(() => {
                    if (config.actionRequestForm && !config.rcmCoverPage && !config.rcmAnalytical) {
                        this.resetToHomePage();
                    }
                }),
                finalize(() => {
                    this.enableButton();
                }),
                debounceTime(120000)
            )
            .subscribe();
    }

    /*Old Implementation For Downloading Document*/
    onClickDownload(config?: RatingRecommendationSaveAndDownloadConfig) {
        if (this.isJapaneseDisclosureApplicable && this.dataService.selectedTemplateType === RatingTemplate.Arf) {
            this.popupJapaneseDisclosure(config);
        } else {
            this.initiateARFGenerationProcess(config);
        }
    }

    popupJapaneseDisclosure(config?: RatingRecommendationSaveAndDownloadConfig) {
        this.modalRef = this.modalService.open(JapanesePrDisclosurePopupComponent, {
            onDownload: (selectedOption) => this.onJapaneseDisclosureConfirmation(selectedOption, config)
        });
    }

    onJapaneseDisclosureConfirmation(
        selectedOption: JapanesePRDisclosure,
        config?: RatingRecommendationSaveAndDownloadConfig
    ) {
        this.modalRef.close();
        this.ratingRecommendationService.updateJapaneseDisclosure(selectedOption);
        this.initiateARFGenerationProcess(config);
    }

    initiateARFGenerationProcess(config?: RatingRecommendationSaveAndDownloadConfig) {
        if (config) {
            const ratingRecommendationViewType =
                config.debtInformation === DebtInformationType.instrument ? 'RATING_CLASS_AND_DEBTS' : 'RATING_CLASS';
            if (config.actionRequestForm) {
                this.generationService.generateArfDocument(RatingTemplate.Arf, ratingRecommendationViewType);
            }
            if (config.rcmCoverPage) {
                this.generationService.generateRCMCoverPagePdfDocument(ratingRecommendationViewType);
            }
            if (config.rcmAnalytical) {
                this.generationService.generateRcmDocument(RatingTemplate.Rcm, ratingRecommendationViewType);
            }
        } else {
            // Default when we dont show Save & Download Dialog
            if (this.isRatingRecommendation) {
                this.generationService.generateDocument(this.dataService.selectedTemplateType);
            } else {
                this.generationService.generateArfRcmDocument(this.dataService.selectedTemplateType);
            }
        }
    }
    /* End of Old Implementation For Downloading Document*/

    /*Manages forward navigation and emit continue event*/
    handleNavigationForward(): void {
        if (this.nextPage) {
            this.casesService.router.navigateByUrl(this.nextPage);
        } else if (this.isDownloadStage && this.isRatingCommitteeWorkflow) {
            this.navigateInviteePage();
        }
        this.continueClickedEventEmitter.emit();
    }

    navigateInviteePage(): void {
        this.casesService.router.navigate([
            AppRoutes.CASE,
            this.dataService.committeSupportWrapper.id,
            AppRoutes.RC_INVITEES
        ]);
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
        if (this.isCommitteeWorkflow) {
            this.navigateInviteePage();
            return;
        }
        this.resetToHomePage();
    }

    ngOnDestroy(): void {
        this.notificationsService.clearNotifications();
        this.unSubscribe$.next();
        this.unSubscribe$.complete();
    }

    private removeUnselectedRatingClasses(
        committeeSupportWrapper: CommitteeSupport,
        selectedRatingRecommendationEntities: SelectedRatingRecommendationEntities,
        ratingRecommendation: BlueTableData
    ) {
        committeeSupportWrapper.entities.forEach((entity) => {
            if (entity.ratingClasses) {
                entity.ratingClasses.forEach((ratingClass) => {
                    ratingClass.ratings.forEach((rating) => {
                        const blueTableData = this.removeUnselectedRatingClassesGetBlueTableData(
                            ratingRecommendation,
                            rating
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

    removeUnselectedRatingClassesGetBlueTableData(ratingRecommendation: BlueTableData, rating: Rating) {
        for (const entity of ratingRecommendation) {
            const blueTableData = entity.children.find(
                (el) => el.isSelected && el.data.entityTableView === 'CLASS' && el.data.identifier === rating.identifier
            );
            if (blueTableData) {
                return blueTableData;
            }
        }
        return null;
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

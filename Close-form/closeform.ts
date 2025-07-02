import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Inject,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    SimpleChanges
} from '@angular/core';
import {
    AbstractControl,
    FormArray,
    FormControl,
    FormGroup,
    UntypedFormArray,
    UntypedFormControl,
    UntypedFormGroup
} from '@angular/forms';
import { CommitteeAttendee } from '@app/close/enums/committee-attendee.enum';
import { CommitteeReason } from '@app/close/enums/committee-reason.enum';
import { VoteEligibility } from '@app/close/enums/vote-eligibility.enum';
import { VoteReason } from '@app/close/enums/vote-reason.enum';
import { AddendumQuestion } from '@app/close/models/addendum-question';
import { Attendee } from '@app/close/models/attendee';
import { CommitteePackage } from '@app/close/models/committee-package';
import { CommitteePackageBridgeRating } from '@app/close/models/committee-package-bridge-rating';
import { COMMITTEE_PACKAGE_STEPS } from '@committeePackage/repository/services/committee-package';
import { BlueModalService, BlueTableData, MultiselectOption } from '@moodys/blue-ng';
import {
    BehaviorSubject,
    Observable,
    ReplaySubject,
    Subject,
    combineLatest,
    map,
    merge,
    shareReplay,
    startWith,
    take,
    takeUntil,
    tap
} from 'rxjs';
import { AppRoutes } from '@app/routes/routes';
import { CasesService } from '@shared/services/cases';
import { CancelConfirmationModalComponent } from '@app/features/cancel-confirmation-modal/cancel-confirmation-modal.component';
import { Dropdown, DropDownValues } from '@app/rating-recommendation/models/interfaces/rating.interface';
import { HeaderService } from '@core/header/header.service';
import { JapanSpecificQuestions } from '@app/close/enums/region-specific-questions';
import { rcCloseRoles } from '@app/participants/constants/rc-close-roles';
import { DEFAULT_ROLE_VALUE, ParticipantRoleEnum } from '@app/participants/enums/participant-role.enum';
import { KeyFactualElement } from '@app/close/models/key-factual-element';
import { UserProfileService } from '@app/shared/services/user-profile-service';
import { UserProfile } from '@app/shared/models/UserProfile';
import { ModalActionService } from '@app/shared/modals/services/modal-action.service';
import { TranslateService } from '@ngx-translate/core';
import { NewInviteeScenario, ReasonForOverride } from '@committeePackage/shared/enums/ineligible-start.enum';
import { ReasonsForDeny } from '@app/vote/enums/reasons-for-deny.enum';
import { debounceTime, delay, filter, switchMap } from 'rxjs/operators';
import { Publications } from '@app/close/models/publications';
import { MethodologyData } from '@app/close/repository/types/methodology-data';
import { CommitteePackageActionListData } from '@app/close/models/committee-package-action-list';
import { AdditionalCommitteeConfirmationModalComponent } from '@app/shared/modals/additional-committee-confirmation-modal/additional-committee-confirmation-modal.component';
import { AdditionalCommitteeConfirmationDialog } from '@app/shared/modals/enums/additional-committee-confirmation-dialog-enums';
import { Lob } from '@app/close/models/lineOfBusiness';
import { ConflictStatus } from '@app/committee-package/shared/enums/conflict-status';
import { UploadType } from '@app/close/enums/upload-type.enum';
import { PackageDocType } from '@app/close/enums/package-doc-type.enum';
import { UploadTypeChangeConfirmDialogComponent } from '../upload-type-change-confirm-dialog/upload-type-change-confirm-dialog.component';
import { AddAttendeeModalComponent } from '../add-attendee-modal/add-attendee-modal.component';
import { ParticipantInitialsPipe } from '@app/shared/pipes/participant-initials/participant-initials.pipe';
import { controlOptions } from '@app/close/models/control-options';
import { overrideReasons } from '@app/close/models/override-reasons';
import { newInviteeScenarios } from '@app/close/models/new-invitee-scenarios';
import { specializedExpertises } from '@app/close/models/specialized-expertises';
import { addendumQuestions } from '@app/close/models/addendum-questions';
import { questionsData } from '@app/close/models/questions-data';
import { DataService } from '@app/shared/services/data.service';
import { RatingGroupType } from '@app/shared/models/RatingGroupType';
import { sfFollowupQuestionsData } from '@app/close/models/sfFollowup-questions';
import { sfUnratedAssetsMethods } from '@app/committee-package/close/models/sf-unrated-assets-methods';
import { sfNotchDifferenceReasons } from '@app/close/models/sf-notch-difference-question';
import { SFIndicatorReason, SFIndicatorReasonType } from '@app/close/repository/types/committee-question-data';

@Component({
    selector: 'app-close-form',
    templateUrl: './close-form.component.html',
    styleUrls: ['./close-form.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CloseFormComponent implements OnChanges, OnDestroy, OnInit {
    MIS = 'MIS';
    RRS = 'RRS';
    roles = rcCloseRoles;
    roleDropdowns: Dropdown[] = [];
    conflictStatus = ConflictStatus;
    sfIndicatorReasonList = [
        {
                "reason": SFIndicatorReasonType.MULTIPLE_CR,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.CREDIT_ESTIMATES,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.CREDIT_ANALYSIS,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.APPLY_NOTCHING,
                "changed": false
            }

    ];

    sfIndicatorNotchReasonList = [
        {
            "reason": SFIndicatorReasonType.MULTIPLE_SCENARIOS,
            "changed": false
        },
        {
            "reason": SFIndicatorReasonType.METHODOLOGY_RATING_CAP_APPLIED,
            "changed": false
        },
        {
            "reason": SFIndicatorReasonType.DIFFERENT_DEAL_PERFORMANCE,
            "changed": false
        },
        {
            "reason": SFIndicatorReasonType.SERVICE_ADJUSTMENT_APPLIED,
            "changed": false
        },
        {
            "reason": SFIndicatorReasonType.TIME_TO_MATURITY_ADJUSTMENT_APPLIED,
            "changed": false
        },
        {
            "reason": SFIndicatorReasonType.THIRD_PARTY_DEPENDENCY_NOT_ADDRESSED,
            "changed": false
        },
        {
            "reason": SFIndicatorReasonType.BENCH_MARKING_ADJUSTMENT_APPLIED,
            "changed": false
        },
        {
            "reason": SFIndicatorReasonType.DEAL_LEVEL_NOT_ADDRESSED,
            "changed": false
        },
        {
            "reason": SFIndicatorReasonType.OTHER,
            "changed": false
        }

];

    @Input() camsId: string;
    @Input() finalOutlookList!: DropDownValues[];
    @Input() finalReviewStatusList!: DropDownValues[];
    @Input() finalLGDList!: DropDownValues[];
    @Input() committeePackage: CommitteePackage | null = null;
    @Input() isLoading = false;
    @Input() docAdded: [] = [];
    @Input() roleReadWrite!: boolean;
    @Input() issuerOutlook: string | null = null;
    @Input() numberOfCommittee: number;
    @Input() methodologies: MethodologyData[];
    @Input() publications: Publications[] = [];
    @Input() actionList: CommitteePackageActionListData[] = [];
    @Input() isFinalized: Date;
    @Input() hasOutdatedMethodology: boolean;
    @Input() notFoundonMDD: boolean;
    @Input() canDeleteCommittee = false;
    @Input() isEntityFromAUS = false;
    @Input() addendumQuestionsAvailableMap: { [key: string]: boolean };
    isActionIdPresent$ = this._headerService.isActionIdPresent$;
    filteredMethodologies = [];
    numberOfVotes = 0;
    @Output() questionLink = new EventEmitter<string>();
    @Output() addBridge = new EventEmitter<{
        committeePackage: CommitteePackage;
        committeePackageBridgeRating: CommitteePackageBridgeRating;
    }>();
    @Output() openAddRemoveQuestion = new EventEmitter<{
        committeePackage: CommitteePackage;
        addendumQuestions: {
            q1: { available: boolean; reason: string };
            q2: { available: boolean; reason: string };
            q3: { available: boolean; reason: string };
            q4: { available: boolean; reason: string };
            q5: { available: boolean; reason: string };
            q6: { available: boolean; reason: string };
            q7: { available: boolean; reason: string };
            q8: {
                available: boolean;
                reason: string;
                newInviteeScenario: string;
                specializedExpertise: string;
                comment: string;
                participants: [];
            };
            q9: {
                available: boolean;
            };
        };
    }>();
    @Output() save = new EventEmitter<{
        publications: Publications[];
        actionList: CommitteePackageActionListData[];
        isClose: boolean;
        data: CommitteePackage;
        redirectToWorklist: boolean;
    }>();

    @Output() navToBackHandler = new EventEmitter<void>();
    @Output() navToNextHandler = new EventEmitter<void>();
    kfeKeyFactualError: Subject<void> = new Subject<void>();
    kfeDataSourceError: Subject<void> = new Subject<void>();
    uploadedFiles: any[] = [];
    isCloseClicked = false;
    keyFactualElements: KeyFactualElement[];
    isFileForConflictCheck: boolean = false;
    readonly committeeAttendee = CommitteeAttendee;
    readonly voteEligibility = VoteEligibility;
    readonly voteReason = Object.values(VoteReason);
    readonly questions = Object.keys(CommitteeReason);
    committeeReason = CommitteeReason;
    private destroy$ = new Subject<void>();
    additionalCommentPlaceholder$ = new BehaviorSubject<string>('');
    showCancelModal = false;
    readonly japanSpecificQuestions = JapanSpecificQuestions;
    readonly japanSpecificQuestionsLabel = Object.values(JapanSpecificQuestions);

    readonly reasonForDeny = ReasonsForDeny;
    readonly reasonForOverride = ReasonForOverride;
    readonly newInviteeScenario = NewInviteeScenario;

    bridgeTableData: BlueTableData = [];
    permissions = [
        COMMITTEE_PACKAGE_STEPS.Ratings,
        COMMITTEE_PACKAGE_STEPS.Analyst,
        COMMITTEE_PACKAGE_STEPS.RatingCommittee
    ];
    questionsData = questionsData;
    sfFollowupQuestionsData = sfFollowupQuestionsData;
    sfUnratedAssetsMethods = sfUnratedAssetsMethods;
    sfNotchDifferenceReasons = sfNotchDifferenceReasons;

    uploadTypeOptions = [
        {
            label: 'closeRatingCommittee.upload.type.coverPageAndAnlytical',
            value: UploadType.CoverPageAndAnlytical
        },
        {
            label: 'closeRatingCommittee.upload.type.complete',
            value: UploadType.Complete
        }
    ];
    UploadType = UploadType;

    committeePackageUploadedFiles = {
        coveragePage: [],
        analytical: [],
        complete: [],
        support: []
    };

    form = new UntypedFormGroup({
        uploadType: new FormControl<UploadType>(UploadType.CoverPageAndAnlytical),
        keyFactualElementChanged: new FormControl<string | null>(null),
        keyFactualElementComment: new FormControl<string | null>(null),

        esgConsiderationChanged: new FormControl<string | null>(null),
        prRatingRationaleChanged: new FormControl<string | null>(null),
        prRatingRationaleComment: new FormControl<string | null>(null),

        ratingConductedInJapan: new FormControl<string | null>(null),
        nonJapanBasedAnalystAttended: new FormControl<string | null>(null),

        creditSfIndicatorChanged: new FormControl<string | null>(null),
        sfUnratedAssets: new FormControl<string | null>(null),
        sfNotchDifference: new FormControl<string | null>(null),
        sfUnratedAssetsTreatment: new FormControl<string | null>(null),
        otherComments: new FormControl<string>(''),
        otherNotchReasonComment: new FormControl<string>(''),
        packageDocuments: new UntypedFormControl([]),

        uploadedDocuments: new UntypedFormGroup({
            coveragePage: new UntypedFormControl([]),
            analytical: new UntypedFormControl([]),
            complete: new UntypedFormControl([]),
            support: new UntypedFormControl([])
        }),

        japanSpecificQuestionsFormGrp: new UntypedFormGroup({
            CSS_KNOWLEDGE: new FormControl<boolean>(false),
            OVERSEAS_INDUSTRIES_KNOWLEDGE: new FormControl<boolean>(false),
            OVERSEAS_SUBSIDIARIES_KNOWLEDGE: new FormControl<boolean>(false),
            FINANCIAL_INSTRUMENTS_KNOWLEDGE: new FormControl<boolean>(false),
            GOVERNMENT_KNOWLEDGE: new FormControl<boolean>(false),
            CREDIT_RATING_KNOWLEDGE: new FormControl<boolean>(false),
            GLOBAL_CREDIT_RATING_GROUP: new FormControl<boolean>(false),
            TRAIN_JUNIOR_STAFF: new FormControl<boolean>(false)
        }),

        addendumQuestions: new UntypedFormGroup(addendumQuestions),
        attendees: new UntypedFormArray([]),
        additionalRatingCommittee: new FormControl<string | null>(null),
        voterConfirmation: new FormControl<string | null>(null)
    });
    availableParticipants: MultiselectOption[];
    eligibleVotersMap: Map<string, string>;
 

    japanSpecificQuestionsKey(value: string): string {
        return Object.keys(JapanSpecificQuestions).find((key) => JapanSpecificQuestions[key] === value) ?? '';
    }

    isBridgeValid$ = new BehaviorSubject(false);
    closeClicked$ = new BehaviorSubject(false);
    saveClicked$ = new BehaviorSubject(false);
    isVoterConfirmed$: Observable<boolean>;
    showBridgeError$: Observable<boolean>;
    addendumCommentErrorState: { [key: string]: boolean } = {};
    saveDisabled$ = merge(this.form.valueChanges, this.addBridge).pipe(
        map(() => false),
        take(1),
        startWith(true)
    );

    controlOptions = controlOptions;

    overrideReasons = overrideReasons;

    newInviteeScenarios = newInviteeScenarios;

    specializedExpertises = specializedExpertises;

    isPACRNARoleSelections$ = new BehaviorSubject<boolean>(false);
    isLANARoleSelections$ = new BehaviorSubject<boolean>(false);
    isPACRNA_LANARoleSelections$ = new BehaviorSubject<boolean>(false);

    showJapanSpecificQuestionsError = new BehaviorSubject<boolean>(false);
    highlightAddendumQuestions = new BehaviorSubject<boolean>(false);
    showRolesError: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
    userProfile$: Observable<UserProfile> = this._userProfileService.userProfile$;
    showRatingRationaleError = new BehaviorSubject<boolean>(false);
    showSfUnratedAssetsError = new BehaviorSubject<boolean>(false);
    showSfUnratedAssetsTreatmentError = new BehaviorSubject<boolean>(false);
    showSfUnratedAssetsReasonsError = new BehaviorSubject<boolean>(false);
    showSfNotchDifferenceError = new BehaviorSubject<boolean>(false);
    showSfNotchDifferenceReasonsError = new BehaviorSubject<boolean>(false);
    showKFEError = new BehaviorSubject<boolean>(false);
    additionalRatingCommittee$ = new BehaviorSubject<boolean>(false);
    keyFactualElementChanged$ = new BehaviorSubject<boolean>(false);
    esgConsiderationChanged$ = new BehaviorSubject<boolean>(false);
    prRatingRationaleChanged$ = new BehaviorSubject<boolean>(false);
    creditSfIndicatorChanged$ = new BehaviorSubject<boolean>(false);
    ratingConductedInJapanError$ = new BehaviorSubject<boolean>(false);
    nonJapanBasedAnalystAttendedError$ = new BehaviorSubject<boolean>(false);
    voterConfirmation$ = new BehaviorSubject<boolean>(false);
    showMultipleLeadAnalystNote = false;
    showMultiplePACRNote = false;
    participantRoleEnum = ParticipantRoleEnum;

    newInviteeOptions = [];
    reasonForOverrideOptions = [];
    isJapanAttendeeError$ = new BehaviorSubject<boolean>(false);
    showJapanQuestion = false;

    ratingCommitteeMethodologies: MethodologyData[];
    ratingCommitteeMethodologySector: string;
    showRatingCommitteeMethodologies = false;
    showRatingCommitteeMethodologiesError$ = new BehaviorSubject<boolean>(false);
    minimumThreeAttendeesVote$ = new BehaviorSubject<boolean>(false);

    // There is multiselect issue that fixed with rerendering component
    numberOfCommitteeUpdated$ = new ReplaySubject<void>(1);
    numberOfCommitteeUpdatedLoading$ = merge(
        this.numberOfCommitteeUpdated$.pipe(map(() => true)),
        this.numberOfCommitteeUpdated$.pipe(
            map(() => true),
            delay(300),
            map(() => false)
        )
    );

    PackageDocType = PackageDocType;
    coveragePageValidFileExtensions = ['.pdf'];
    analyticalValidFileExtensions = ['.docx', '.doc'];
    constructor(
        private casesService: CasesService,
        @Inject(BlueModalService) private modalService: BlueModalService,
        private readonly _headerService: HeaderService,
        private readonly _userProfileService: UserProfileService,
        private readonly _modalActionService: ModalActionService,
        private readonly _translateService: TranslateService,
        private _cdr: ChangeDetectorRef,
        private _dataService: DataService
    ) {
        // On every upload type option change, reset currently the uploaded documents
        this.form
            .get('uploadType')
            ?.valueChanges.pipe(
                tap((value) => {
                    const dialogRef = this.modalService.open(UploadTypeChangeConfirmDialogComponent, {
                        title: AdditionalCommitteeConfirmationDialog.ExitTitle,
                        acceptLabel: AdditionalCommitteeConfirmationDialog.ExitConfirmButton,
                        dismissLabel: AdditionalCommitteeConfirmationDialog.NoActionButton,
                        confirm: () => {
                            this.form.get('uploadType').setValue(value, { emitEvent: false });
                            const formUploadedDocuments = this.form.get('uploadedDocuments');
                            formUploadedDocuments.get('coveragePage').setValue([]);
                            formUploadedDocuments.get('analytical').setValue([]);
                            formUploadedDocuments.get('complete').setValue([]);
                            dialogRef.close();
                            this._cdr.detectChanges();
                        },
                        cancel: () => {
                            this.form
                                .get('uploadType')
                                .setValue(
                                    value === UploadType.CoverPageAndAnlytical
                                        ? UploadType.Complete
                                        : UploadType.CoverPageAndAnlytical,
                                    { emitEvent: false }
                                );
                            dialogRef.close();
                            this._cdr.detectChanges();
                        }
                    });
                }),
                takeUntil(this.destroy$)
            )
            .subscribe();

        this.form
            .get('attendees')
            ?.valueChanges.pipe(
                tap(() => (this.showJapanQuestion = this.displayJapanQuestion())),
                takeUntil(this.destroy$)
            )
            .subscribe();

        merge(this.saveClicked$, this.closeClicked$)
            .pipe(
                filter((value) => !!value),
                switchMap(() =>
                    merge(
                        this.form.get('prRatingRationaleChanged').valueChanges,
                        this.form.get('prRatingRationaleComment').valueChanges
                    )
                ),
                debounceTime(300),
                tap(() => this.isPrRatingRationaleInvalid()),
                takeUntil(this.destroy$)
            )
            .subscribe();
        this.showBridgeError$ = combineLatest([this.isBridgeValid$, merge(this.closeClicked$, this.saveClicked$)]).pipe(
            map(([isBridgeValid, isClicked]) => !isBridgeValid && isClicked),
            shareReplay({ bufferSize: 1, refCount: true })
        );

        this._modalActionService.updateComponentDataEvent.pipe(takeUntil(this.destroy$)).subscribe(() => {
            this.saveCommitteeData(false, true);
        });

        this.setAddendumQ8AdditionalComment();
        this.form.get('addendumQuestions.q7.reason').disable();
    }
    isReasonSelected(id: string): boolean {
        return this.sfIndicatorNotchReasonList[Number(id)-1].changed;
    }

    toggleNotchReason(id: string, checked: boolean) {
        this.sfIndicatorNotchReasonList[Number(id)-1].changed = checked;
        this.showSfNotchDifferenceReasonsError.next(false);
    }

    private setAddendumQ8AdditionalComment() {
    const addendumQ8 = this.form.get('addendumQuestions.q8');
    merge(
        addendumQ8.get('reason').valueChanges.pipe(
            tap((value) => {
                if (value !== ReasonForOverride.NewInviteeAdded) {
                    addendumQ8.patchValue(
                        {
                            newInviteeScenario: '',
                            specializedExpertise: '',
                            participants: []
                        },
                        { emitEvent: false }
                    );
                    this.form.get('addendumQuestions.q8.specializedExpertise').clearValidators();
                    this.form.get('addendumQuestions.q8.specializedExpertise').updateValueAndValidity();
                    this.form.get('addendumQuestions.q8.newInviteeScenario').clearValidators();
                    this.form.get('addendumQuestions.q8.newInviteeScenario').updateValueAndValidity();
                }
            })
        ),
        addendumQ8.get('newInviteeScenario').valueChanges.pipe(filter(() => true)),
        addendumQ8.get('specializedExpertise').valueChanges.pipe(filter(() => true)),
        addendumQ8.get('participants').valueChanges.pipe(filter(() => true))
    )
        .pipe(
            tap(() => {
                const newInviteeScenario = addendumQ8.get('newInviteeScenario').value;
                const participants =
                    newInviteeScenario === ReasonForOverride.SuddenMarketEvent ||
                    newInviteeScenario === ReasonForOverride.RatingErrorCorrection
                        ? ''
                        : this.getSelectedParticipants();
                const specializedExpertiseDropdownValue =
                    addendumQ8.get('newInviteeScenario').value === NewInviteeScenario.SpecializedExpertise &&
                    addendumQ8.get('specializedExpertise').value
                        ? this._translateService
                              .instant(
                                  this.specializedExpertises.find(
                                      (el) => el.value === addendumQ8.get('specializedExpertise').value
                                  )?.label
                              )
                              ?.toLocaleLowerCase()
                        : '';
                const comment = this.getAdditionalComment(
                    newInviteeScenario ? newInviteeScenario : addendumQ8.get('reason').value,
                    participants,
                    specializedExpertiseDropdownValue
                );
                
                if (
                    addendumQ8.get('reason').value === ReasonForOverride.SuddenMarketEvent ||
                    addendumQ8.get('reason').value === ReasonForOverride.RatingErrorCorrection
                ) {
                    this.additionalCommentPlaceholder$.next(comment);
                }

                    if (
                        newInviteeScenario === NewInviteeScenario.ExternalAppeal ||
                        newInviteeScenario === NewInviteeScenario.InternalAppeal ||
                        newInviteeScenario === NewInviteeScenario.LackOfMajority ||
                        newInviteeScenario === NewInviteeScenario.SpecializedExpertise
                    ) {
                        addendumQ8.get('comment').setValue(comment, { emitEvent: false });
                    } else {
                        addendumQ8.get('comment').setValue('', { emitEvent: false });
                    }
                }),
                takeUntil(this.destroy$)
            )
            .subscribe();
    }

    getAdditionalCommentForNewInvitee(reason: string): any {
        const addendumQ8 = this.form.get('addendumQuestions.q8');
        if (
            reason === NewInviteeScenario.ExternalAppeal ||
            reason === NewInviteeScenario.InternalAppeal ||
            reason === NewInviteeScenario.LackOfMajority ||
            reason === NewInviteeScenario.SpecializedExpertise
        ) {
            return addendumQ8.value.comment;
        } else {
            return '';
        }
    }
    getAdditionalCommentPlaceholder(reason: string, participants: string, specializedExpertise: string): string {
        return this.getAdditionalComment(reason, participants, specializedExpertise);
    }

    private getSelectedParticipants() {
        return this.form
            .get('addendumQuestions.q8.participants')
            ?.value?.map((p) => this.eligibleVotersMap.get(p))
            .join(', ');
    }

    private getAdditionalComment(reason: string, participants: string, specializedExpertise: string): string {
        switch (reason) {
            case ReasonForOverride.SuddenMarketEvent:
                return this._translateService.instant(
                    'closeRatingCommittee.addendumQuestions.q8.comment.suddenMarketEvent'
                );
            case ReasonForOverride.RatingErrorCorrection:
                return this._translateService.instant(
                    'closeRatingCommittee.addendumQuestions.q8.comment.ratingErrorCorrection'
                );
            case NewInviteeScenario.ExternalAppeal:
                return participants
                    ? this._translateService.instant(
                          'closeRatingCommittee.addendumQuestions.q8.comment.externalAppeal',
                          { participants }
                      )
                    : '';
            case NewInviteeScenario.InternalAppeal:
                return participants
                    ? this._translateService.instant(
                          'closeRatingCommittee.addendumQuestions.q8.comment.internalAppeal',
                          { participants }
                      )
                    : '';
            case NewInviteeScenario.LackOfMajority:
                return participants
                    ? this._translateService.instant(
                          'closeRatingCommittee.addendumQuestions.q8.comment.lackOfMajority',
                          { participants }
                      )
                    : '';
            case NewInviteeScenario.SpecializedExpertise:
                return participants !== '' && specializedExpertise !== ''
                    ? this._translateService.instant(
                          'closeRatingCommittee.addendumQuestions.q8.comment.specializedExpertise',
                          {
                              participants,
                              specializedExpertise
                          }
                      )
                    : '';
            default:
                return '';
        }
    }
    ngOnInit() {
            this.form.get('addendumQuestions')?.valueChanges.subscribe(() => this.updateAddendumCommentErrorState());
    this.saveClicked$.subscribe(() => this.updateAddendumCommentErrorState());
        this.form.get('addendumQuestions.q8.reason')?.valueChanges.subscribe((value) => {
            this.onAddendumQuestionChange(value);
            const addendumQ8 = this.form.get('addendumQuestions.q8');
             this.updateQ8ValidatorsForScenario(value);
            const placeholder = this.getQ8CommentPlaceholder(value);
            this.additionalCommentPlaceholder$.next(placeholder);
            addendumQ8.get('comment').setValue('', { emitEvent: false });
            this.form.get('addendumQuestions.q8.newInviteeScenario')?.setValue('');
            this.isCloseClicked = false;
        });
        this.form.get('addendumQuestions.q8.newInviteeScenario')?.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe((scenario) => {
            this.onAddendumQuestionChange(scenario);
            this.updateQ8ValidatorsForScenario(scenario);
            this.form.get('addendumQuestions.q8.specializedExpertise')?.setValue('');
            this.form.get('addendumQuestions.q8.participants')?.setValue([]);
            this.isCloseClicked = false;
        });
        this.form.get('addendumQuestions.q8.specializedExpertise')?.valueChanges.subscribe((value) => {
            this.onAddendumQuestionChange(value);
            this.form.get('addendumQuestions.q8.participants')?.setValue([]);
            this.isCloseClicked = false;
            this.saveClicked$.next(false);
        });
        this.form.get('addendumQuestions.q8.comment')?.valueChanges.subscribe((value) => {
            this.onAddendumQuestionChange(value);
            const placeholder = this.getQ8CommentPlaceholder(value);
            this.additionalCommentPlaceholder$.next(placeholder);
            this.isCloseClicked = false;
        });
        this.form.get('addendumQuestions.q8.reason').valueChanges.subscribe((reason) => {
            const participantsControl = this.form.get('addendumQuestions.q8.participants');
            if (reason === this.reasonForOverride.NewInviteeAdded) {
                participantsControl.setValidators([
                    (control) => (control.value && control.value.length > 0 ? null : { required: true })
                ]);
            } else {
                participantsControl.clearValidators();
            }
            participantsControl.updateValueAndValidity();
            this.saveClicked$.next(false);
        });
        this.form.get('creditSfIndicatorChanged').valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(val => {
            if (val === 'false') {
                this.form.get('sfUnratedAssets').setValue(null);
                this.form.get('sfNotchDifference').setValue(null);
                for( const sfFollowupQuestions of this.sfFollowupQuestionsData){
                    sfFollowupQuestions.isError = false;
                }

            }
        });
        this.form.get('sfUnratedAssets').valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(val => {
                if (val !== 'true') {
                    this.form.get('sfUnratedAssetsTreatment').setValue(null);
                }
            });
        this.form.get('addendumQuestions.q8.participants')?.valueChanges.subscribe((value) => {
            this.onAddendumQuestionChange(value);
            this.isCloseClicked = false;
        });                                                                             
    }
    private updateAddendumCommentErrorState() {
    const addendumQuestions = this.form.get('addendumQuestions') as FormGroup;
    this.addendumCommentErrorState = {};
    Object.keys(addendumQuestions.controls).forEach(key => {
        const group = addendumQuestions.get(key) as FormGroup;
        if (!group) return;
        const reason = group.get('reason')?.value;
        const comment = group.get('comment')?.value;
        this.addendumCommentErrorState[key] =
            (reason === this.reasonForOverride.Other || reason === '' || reason === this.reasonForOverride.SuddenMarketEvent || reason === this.reasonForOverride.RatingErrorCorrection)
            && (!comment || comment.trim() === '')
            && ((this.saveClicked$.value) || this.isCloseClicked);
    });
}

    private updateQ8ValidatorsForScenario(scenario: string) {
        const q8Group = this.form.get('addendumQuestions.q8') as FormGroup;

        q8Group.get('specializedExpertise').clearValidators();
        q8Group.get('comment').clearValidators();

        if (scenario === NewInviteeScenario.SpecializedExpertise) {
            q8Group.get('specializedExpertise').setValidators([control => control.value ? null : { required: true }]);
        }

        if (
            scenario === ReasonForOverride.SuddenMarketEvent ||
            scenario === ReasonForOverride.RatingErrorCorrection
        ) {
            q8Group.get('comment').setValidators([control => control.value && control.value.trim() !== '' ? null : { required: true }]);
        }

        q8Group.get('specializedExpertise').updateValueAndValidity();
        q8Group.get('comment').updateValueAndValidity();
    }
    getQ8CommentPlaceholder(value: string): string {
        const addendumQ8 = this.form.get('addendumQuestions.q8');
        const newInviteeScenario = addendumQ8.get('newInviteeScenario').value;
        const participants =
            newInviteeScenario === ReasonForOverride.SuddenMarketEvent ||
            newInviteeScenario === ReasonForOverride.RatingErrorCorrection
                ? ''
                : this.getSelectedParticipants();
        const specializedExpertiseDropdownValue =
            newInviteeScenario === NewInviteeScenario.SpecializedExpertise &&
            addendumQ8.get('specializedExpertise').value
                ? this._translateService
                      .instant(
                          this.specializedExpertises.find(
                              (el) => el.value === addendumQ8.get('specializedExpertise').value
                          )?.label
                      )
                      ?.toLocaleLowerCase()
                : '';
        const placeholder = this.getAdditionalComment(
            value ? value : addendumQ8.get('reason').value,
            participants,
            specializedExpertiseDropdownValue
        );
        return placeholder;
    }
    ngOnChanges(changes: SimpleChanges): void {
        if (changes['docAdded']) {
            this.setUploadDocuments(this.docAdded);
            this.form.get('uploadedDocuments').reset();
        }
        if (changes['methodologies']) {
            this.filterMethodologies();
        }

        if (changes['numberOfCommittee']) {
            this.resetForm();
            this.setUploadDocuments(this.committeePackage?.packageDocuments);
            this.setUploadType();
            this.numberOfCommitteeUpdated$.next();
            this.resetValidations();
            this.setReasonForOverrideOptions();
            this.setNewInviteeScenarioOptions();
            this.form.get('uploadedDocuments').reset();
        }

        /**
         * @description
         * on close page change or on bridge change
         */
        if (changes['committeePackage']) {
            this.keyFactualElements = this.committeePackage?.keyFactualElements ?? [];
            this.setTopQuestions();
            this.setTableData();
            this.setAttendees();
            this.setAddendumQuestions();
            this.setOtherComments();
            this.setBridgeValidation();
            this.setJapanSpecificQuestions();
            this.setAdditionalRatingCommittee();
            this.setRatingCommitteeMethodologies();
            this.setVoterConfirmartion();
        } 
        if (changes['actionList']) {
            this._headerService.updateActionIds(this.actionList?.map((action) => action.id.toString()));
        }
        if (changes['addendumQuestionsAvailableMap'] && this.addendumQuestionsAvailableMap) {
        Object.keys(this.addendumQuestionsAvailableMap).forEach(key => {
            this.checkControlForAddendumQuestions(key);
        });
        }
    }
    private resetSfMethods(){
        this.sfIndicatorReasonList = [
            {
                    "reason": SFIndicatorReasonType.MULTIPLE_CR,
                    "changed": false
                },
                {
                    "reason": SFIndicatorReasonType.CREDIT_ESTIMATES,
                    "changed": false
                },
                {
                    "reason": SFIndicatorReasonType.CREDIT_ANALYSIS,
                    "changed": false
                },
                {
                    "reason": SFIndicatorReasonType.APPLY_NOTCHING,
                    "changed": false
                }
    
        ];
        this.sfIndicatorNotchReasonList = [
            {
                "reason": SFIndicatorReasonType.MULTIPLE_SCENARIOS,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.METHODOLOGY_RATING_CAP_APPLIED,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.DIFFERENT_DEAL_PERFORMANCE,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.SERVICE_ADJUSTMENT_APPLIED,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.TIME_TO_MATURITY_ADJUSTMENT_APPLIED,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.THIRD_PARTY_DEPENDENCY_NOT_ADDRESSED,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.BENCH_MARKING_ADJUSTMENT_APPLIED,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.DEAL_LEVEL_NOT_ADDRESSED,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.OTHER,
                "changed": false
            }
    
    ];
    }

    private checkControlForAddendumQuestions(key){
            const control = this.form.get('addendumQuestions.' + key + '.available');
            if (control) {
                control.setValue(this.addendumQuestionsAvailableMap[key]);
    
                if (!this.addendumQuestionsAvailableMap[key]) {
                    const group = this.form.get('addendumQuestions.' + key) as FormGroup;
                this.checkGroup(group);
            }
        }
    }

    private checkGroup(group){
                    if (group) {
                        Object.keys(group.controls).forEach(ctrlKey => {
                            if (ctrlKey !== 'available') {
                                group.get(ctrlKey)?.setValue(Array.isArray(group.get(ctrlKey)?.value) ? [] : '');
            }
        });
        }
    }
    isMethodSelected(id: string): boolean {
        return this.sfIndicatorReasonList[Number(id)-1].changed;
    }
    onA1Yes() {
        // Optionally reset selection
        this.resetReasonList();
    }
    toggleMethod(id: string, checked: boolean) {
        this.sfIndicatorReasonList[Number(id)-1].changed = checked;
        this.showSfUnratedAssetsReasonsError.next(false);
    }
    private resetValidations(): void {
        this.isCloseClicked = false;
        this.closeClicked$.next(false);
        this.saveClicked$.next(false);
        this.showKFEError.next(false);
        this.highlightAddendumQuestions.next(false);
        this.showJapanSpecificQuestionsError.next(false);
        this.showRolesError.next(false);
        this.additionalRatingCommittee$.next(false);
        this.voterConfirmation$.next(false);
        this.keyFactualElementChanged$.next(false);
        this.esgConsiderationChanged$.next(false);
        this.prRatingRationaleChanged$.next(false);
        this.creditSfIndicatorChanged$.next(false);
        this.showRatingCommitteeMethodologiesError$.next(false);
        this.isJapanAttendeeError$.next(false);
        this.showRatingRationaleError.next(false);
        this.showSfUnratedAssetsError.next(false);
        this.showSfNotchDifferenceError.next(false);
        this.ratingConductedInJapanError$.next(false);
        this.nonJapanBasedAnalystAttendedError$.next(false);
        this.minimumThreeAttendeesVote$.next(false);

        for (const questionsData of this.questionsData) {
            questionsData.isError = false;
        }
        for( const sfFollowupQuestionsData of this.sfFollowupQuestionsData){
            sfFollowupQuestionsData.isError=false;
        }

        if(this.isRatingGroupTypeSovereign()){
            this.questionsData[3].disabled = false;
        }else{
            this.questionsData[3].disabled = true;
        }


    }
    private isRatingGroupTypeSovereign():boolean{
        return [RatingGroupType.SovereignBond, RatingGroupType.SovereignMDB, RatingGroupType.SubSovereign].includes(this._dataService.getSelectedRatingGroup());
    }

    private filterMethodologies(): void {
        const jurisdiction = this.committeePackage.jurisdiction;
        this.filteredMethodologies = this.methodologies
            ?.map((methodology) => {
                const publication = methodology.publications?.find((pub) => pub.jurisdiction === jurisdiction);
                return publication ? { ...methodology, publications: [publication] } : null;
            })
            .filter((methodology) => methodology !== null);
    }

    private resetForm() {
        Object.keys(this.form.controls).forEach((key) => {
            if (!this.skipReset(key)) this.form.get(key).reset();
        });
        if(!this.isRatingGroupTypeSovereign()){
            this.form.get('creditSfIndicatorChanged')?.setValue('false', { emitEvent: false });
        }
        this.form.get('uploadType').setValue(UploadType.CoverPageAndAnlytical, { emitEvent: false });
    }

    private setReasonForOverrideOptions(): void {
        this.reasonForOverrideOptions = this.overrideReasons.filter(
            (el) => !el.applicableCommittees || el.applicableCommittees.includes(this.numberOfCommittee)
        );
    }

    private setNewInviteeScenarioOptions(): void {
        this.newInviteeOptions = this.newInviteeScenarios.filter(
            (el) => !el.notApplicableCommittees || !el.notApplicableCommittees.includes(this.numberOfCommittee)
        );
    }

    private skipReset(key?: string) {
        return key === 'uploadType' || key === 'uploadedDocuments';
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngAfterContentInit() {
        this.form?.valueChanges.pipe().subscribe(() => {
            this.showCancelModal = true;
        });
    }

    removeFile(fileToRemove: any): void {
        // TO DO: REMOVE
        fileToRemove.isDeleted = true;
        const index = this.uploadedFiles.findIndex((uploadedFile) => uploadedFile.refId === fileToRemove.refId);
        if (index > -1) {
            this.uploadedFiles.splice(index, 1);
        }
    }

    isBridgeValid(): boolean {
        let isBridgeValid = true;

        // Check if all ratings have a bridge
        this.committeePackage.bridge?.forEach((bridge) => {
            isBridgeValid = bridge.ratings
                .filter(
                    (rating) =>
                        (rating.recommended.rating !== rating.final.rating &&
                            rating.recommended.rating !== rating.final.outlook) ||
                        rating.finalRatingLabel === '-'
                )
                .every((rating) => {
                    return !!rating.bridge;
                });
        });

        return isBridgeValid;
    }

    setBridgeValidation(): void {
        this.isBridgeValid$.next(this.isBridgeValid());
    }

    setTopQuestions() {
        if (this.committeePackage?.keyFactualElementChanged !== undefined) {
            this.form
                .get('keyFactualElementChanged')
                ?.setValue(this.committeePackage?.keyFactualElementChanged.changed?.toString(), { emitEvent: false });

            this.form
                .get('keyFactualElementComment')
                ?.setValue(this.committeePackage?.keyFactualElementChanged.comment, { emitEvent: false });
        }

        if (this.committeePackage?.esgConsiderationChanged !== undefined) {
            this.form
                .get('esgConsiderationChanged')
                ?.setValue(this.committeePackage?.esgConsiderationChanged.changed?.toString(), { emitEvent: false });
            this.form
                .get('esgConsiderationComment')
                ?.setValue(this.committeePackage?.esgConsiderationChanged.comment, { emitEvent: false });
        }

        if (this.committeePackage?.prRatingRationaleChanged !== undefined) {
            this.form
                .get('prRatingRationaleChanged')
                ?.setValue(this.committeePackage?.prRatingRationaleChanged.changed?.toString(), { emitEvent: false });
            this.form
                .get('prRatingRationaleComment')
                ?.setValue(this.committeePackage?.prRatingRationaleChanged.comment, { emitEvent: false });
        }

        this.setTopQuestionsSfIndicator();
    }

    setTopQuestionsSfIndicator(){
        if(this.isRatingGroupTypeSovereign()){
            if (this.committeePackage?.creditSfIndicatorChanged !== undefined) {
                this.form
                    .get('creditSfIndicatorChanged')
                    ?.setValue(this.committeePackage?.creditSfIndicatorChanged.changed?.toString(), { emitEvent: false });
            
            }
            if(this.committeePackage?.sfUnratedAssets !== undefined){
                this.form
                    .get('sfUnratedAssets')
                    ?.setValue(this.committeePackage?.sfUnratedAssets.changed?.toString(), { emitEvent: false });
            }
            if(this.committeePackage?.sfNotchDifference !== undefined){
                this.form
                    .get('sfNotchDifference')
                    ?.setValue(this.committeePackage?.sfNotchDifference.changed?.toString(), { emitEvent: false });
                this.form
                    .get('otherNotchReasonComment')
                    ?.setValue(this.committeePackage?.sfNotchDifference.comment, { emitEvent: false });
                if(this.committeePackage?.sfNotchDifference.reasons){
                    this.sfIndicatorNotchReasonList = this.committeePackage?.sfNotchDifference.reasons
                }
            }
            if(this.committeePackage?.sfUnratedAssetsTreatment !== undefined){
                this.form
                    .get('sfUnratedAssetsTreatment')
                    ?.setValue(this.committeePackage?.sfUnratedAssetsTreatment.changed?.toString(), { emitEvent: false });
                if(this.committeePackage?.sfUnratedAssetsTreatment.reasons){
                    this.sfIndicatorReasonList = this.committeePackage?.sfUnratedAssetsTreatment.reasons
                }
            }
        }
    }

    setAttendees() {
        if (!this.committeePackage?.attendees) {
            return;
        }
        this.attendees.clear();
        this.roleDropdowns = [];
        this.committeePackage?.attendees.forEach((attendee) => {
            /**
             * IF any of the attendees have conflict status of "Unknown" or "Ineligible"
             * THEN System should hide these cards from the Attendees section
             */

            attendee.role = this.roles.find((role) => role.value === attendee.role)?.value ?? 'Select';
            if (attendee.role === 'Select') {
                this.roleDropdowns.push({ selectedValue: null });
            } else {
                this.roleDropdowns.push({ selectedValue: attendee.role });
            }
            if (
                attendee.role === ParticipantRoleEnum.LeadAnalystNonAttendee ||
                attendee.role === ParticipantRoleEnum.PACRNonAttendee
            ) {
                attendee.eligibleToVote = false;
            } else {
                attendee.eligibleToVote =
                    attendee?.conflictStatus === this.conflictStatus.Eligible ||
                    attendee?.conflictStatus === this.conflictStatus.EligibleCantVote;
            }

            /**
             * @description
             * RCMGMT-11557
             * System should display default selection of Selected to Vote column as Yes
             */

            if (attendee.selectedToVote === undefined) {
                attendee.selectedToVote = true;
            }

            this.addAttendee(attendee);
        });
    }

    setRatingCommitteeMethodologies() {
        this.ratingCommitteeMethodologySector = this.committeePackage.methodologySector;
        this.ratingCommitteeMethodologies = this.committeePackage.methodologies;
        this.setShowRatingCommitteeMethodologies();
    }

    setShowRatingCommitteeMethodologies() {
        this.showRatingCommitteeMethodologies =
            this.actionList?.length === 0 &&
            (this.ratingCommitteeMethodologies?.length > 0 || this.filteredMethodologies?.length === undefined);
    }

    deleteAttendee(index: number) {
        this.attendees.at(index).get('isDeleted')?.setValue(true, { emitEvent: false });
        this.attendees.at(index).get('role')?.setValue(null, { emitEvent: false });

        this.setAddendumQuestions();
    }

    private _createAttendeeForm(attendee: Attendee): UntypedFormGroup {
        const formGroup = new UntypedFormGroup({
            id: new FormControl<number>(attendee.id),
            firstName: new FormControl<string>(attendee.firstName),
            lastName: new FormControl<string>(attendee.lastName),
            title: new FormControl<string>(attendee.title),
            role: new FormControl<string>(attendee.role),
            voted: new FormControl<boolean>(attendee.voted),
            eligibleToVote: new FormControl<boolean>(attendee.eligibleToVote),
            selectedToVote: new FormControl<boolean>(attendee.selectedToVote),
            initials: new FormControl<string>(attendee.initials),
            attendedCommittee: new FormControl<boolean | undefined>(attendee.attendedCommittee ?? true),
            conflictStatus: new FormControl<string>(attendee?.conflictStatus),
            approval: new FormControl<boolean>(attendee.approval),
            isDeleted: new FormControl<boolean>(attendee.isDeleted),
            added: new FormControl<boolean>(attendee.added),
            isInviteeDeleted: new FormControl<boolean>(attendee.isInviteeDeleted),
            country: new FormControl<string>(attendee.country),
            lineOfBusiness: new FormControl<Lob>(attendee.lineOfBusiness),
            isExpertise: new FormControl<boolean | undefined>(attendee.isExpertise)
        });

        /**
         * RCMGMT-9448
         * The system should disable the button and set it to ‘No’ by default if any invitee’s status is
         * Not Eligible to Vote, pre-populated in the Vote eligibility column.
         */
        if (!attendee.eligibleToVote && !attendee.voted) {
            formGroup.get('voted').setValue(false);
            formGroup.get('voted').disable();
        }

        if (attendee.role === 'Select') {
            formGroup.get('attendedCommittee').setValue(true);
            formGroup.get('voted').setValue(true);
        }

        if (
            attendee.lineOfBusiness?.entity.code === this.MIS &&
            attendee.lineOfBusiness?.shortDescription === this.RRS
        ) {
            formGroup.get('role').setValue(ParticipantRoleEnum.CommitteeAttendee);
            formGroup.get('role').disable();

            formGroup.get('eligibleToVote').setValue(false);
            formGroup.get('eligibleToVote').disable();

            formGroup.get('selectedToVote').setValue(false);
            formGroup.get('selectedToVote').disable();

            formGroup.get('voted').setValue(false);
            formGroup.get('voted').disable();
        }
        this._disableRadioBasedOnRoleAndVoted(formGroup);

        return formGroup;
    }

    private _disableRadioBasedOnRoleAndVoted(formGroup: UntypedFormGroup) {
        if (
            formGroup.get('role').value === ParticipantRoleEnum.LeadAnalystNonAttendee ||
            formGroup.get('role').value === ParticipantRoleEnum.PACRNonAttendee
        ) {
            formGroup.get('attendedCommittee').disable();
            formGroup.get('selectedToVote').disable();
            formGroup.get('voted').disable();
        }

        if (!formGroup.get('attendedCommittee').value) {
            formGroup.get('selectedToVote').disable();
            formGroup.get('voted').disable();
        }

        if (!formGroup.get('selectedToVote').value) {
            formGroup.get('voted').disable();
        }
    }

    private updateControl(control: AbstractControl, value: boolean): void {
        control.setValue(value, { emitEvent: false });
        control[value ? 'enable' : 'disable']({ emitEvent: false });
    }

    addAttendee(attendee: Attendee) {
        const attendeeForm = this._createAttendeeForm(attendee);
        this.attendees.push(attendeeForm);
        attendeeForm
            .get('attendedCommittee')
            ?.valueChanges.pipe(
                tap((value) => {
                    const selectedToVote = attendeeForm.get('selectedToVote');
                    const voted = attendeeForm.get('voted');

                    if (
                        attendee.lineOfBusiness?.entity.code === this.MIS &&
                        attendee.lineOfBusiness?.shortDescription === this.RRS &&
                        selectedToVote.disabled &&
                        voted.disabled
                    ) {
                        selectedToVote.setValue(false, { emitEvent: false });
                        voted.setValue(false, { emitEvent: false });
                    } else {
                        selectedToVote.setValue(value, { emitEvent: false });
                        this.updateControl(voted, value);
                        this.updateControl(selectedToVote, value);
                    }
                }),
                takeUntil(this.destroy$)
            )
            .subscribe();

        attendeeForm
            .get('role')
            ?.valueChanges.pipe(
                tap((value) => {
                    if (
                        value === 'Select' ||
                        !(
                            value === ParticipantRoleEnum.LeadAnalystNonAttendee ||
                            value === ParticipantRoleEnum.PACRNonAttendee
                        )
                    ) {
                        attendeeForm.get('attendedCommittee').setValue(true);
                        attendeeForm.get('voted').setValue(true);
                    }
                }),
                takeUntil(this.destroy$)
            )
            .subscribe();

        attendeeForm
            .get('selectedToVote')
            ?.valueChanges.pipe(
                tap((value) => {this.updateControl(attendeeForm.get('voted'), value)
                this.isVotedSelectedMinimumThree()}),
                takeUntil(this.destroy$)
            )
            .subscribe();
        
        attendeeForm
            .get('attendedCommittee')
            ?.valueChanges.pipe(
                tap(() => this.isVotedSelectedMinimumThree()),
                takeUntil(this.destroy$)
            )
            .subscribe();

        attendeeForm
            .get('voted')
            ?.valueChanges.pipe(
                tap(() => this.isVotedSelectedMinimumThree()),
                takeUntil(this.destroy$)
            )
            .subscribe();
    }

    get attendees() {
        return this.form.controls['attendees'] as UntypedFormArray;
    }

    get packageDocuments() {
        return this.form.controls['packageDocuments'] as UntypedFormArray;
    }

    get attendeesFormArrayControls() {
        return this.attendees.controls as FormGroup[];
    }
    get sfNotchDifferenceReasonsArray(): FormArray {
        return this.form.get('sfNotchDifferenceReasons') as FormArray;
    }
    clearAddendumQuestionsErrors() {
        this.form.get('addendumQuestions.q8.comment').clearValidators();
        this.form.get('addendumQuestions.q8.comment').updateValueAndValidity();
        this.form.get('addendumQuestions.q8.reason').clearValidators();
        this.form.get('addendumQuestions.q8.reason').updateValueAndValidity();
    }

    setAddendumQuestions() {
        if (this.committeePackage?.addendumQuestions?.length == 0) {
            this.clearAddendumQuestionsErrors();
            return;
        }
        this.committeePackage.hasHongkongSingaporeInvitee = null;
        Object.keys(this.form.get('addendumQuestions')?.value).forEach((addendumQuestionKey) => {
            const addendumQuestion = this.committeePackage?.addendumQuestions?.find(
                (el) => el.key === addendumQuestionKey
            );

            const addendumQuestionFormValues = {
                available: !!addendumQuestion,
                reason: addendumQuestion?.reason ?? ''
            };

            const eligibleVoters = this.attendees.value?.filter(
                (attendee) => attendee.eligibleToVote && !(attendee.isDeleted || attendee.isInviteeDeleted)
            );
            const participants = eligibleVoters
                ?.filter((attendee) => attendee.isExpertise === true)
                .map((attendee) => attendee.id.toString());

            if (addendumQuestion?.key === CommitteeReason.INELIGIBLE_START) {
                Object.assign(addendumQuestionFormValues, {
                    newInviteeScenario: addendumQuestion?.newInviteeScenario ?? '',
                    specializedExpertise: addendumQuestion?.specializedExpertise ?? '',
                    comment: addendumQuestion?.comment ?? '',
                    participants
                });
            }
            if (addendumQuestion?.key === CommitteeReason.HK_SG_INVITEE) {
                this.committeePackage.hasHongkongSingaporeInvitee = true;
            }

            this.availableParticipants =
                eligibleVoters?.map((participant) => {
                    const option: MultiselectOption = {
                        label: `${participant.firstName} ${participant.lastName}`,
                        value: participant.id.toString(),
                        data: participant
                    };
                    return option;
                }) ?? [];

            this.eligibleVotersMap = new Map(
                eligibleVoters?.map((participant) => [
                    participant.id.toString(),
                    `${participant.firstName} ${participant.lastName}, ${participant.title}, ${participant.lineOfBusiness?.entity?.code}`
                ])
            );

            if (addendumQuestion?.key === CommitteeReason.NO_MOODYS_POLICY_COMPLIED) {
                addendumQuestionFormValues.reason = this._translateService.instant(
                    'closeRatingCommittee.addendumQuestions.q7.errorMessage'
                );
            }

            this.form
                .get('addendumQuestions')
                ?.get(addendumQuestionKey)
                ?.patchValue(addendumQuestionFormValues, { emitEvent: false });
        });
    }

    getReviewStatusLabel(isOutlook: boolean, reviewStatus: string): string {
        if (isOutlook) {
            return '-';
        }

        return (
            this.finalReviewStatusList.find((finalReviewStatus) => finalReviewStatus.value === reviewStatus)?.name ??
            '-'
        );
    }

    getRatingLabel(isLGD: boolean, rating: string): string {
        if (!isLGD) {
            if (rating === 'NO_ACTION') {
                return 'No Action';
            }
            return rating ?? '-';
        }

        return this.finalLGDList.find((finalLGD) => finalLGD.value === rating)?.name ?? rating ?? '-';
    }

    setTableData() {
        if (!this.committeePackage) {
            return;
        }
        this.bridgeTableData = this.committeePackage.bridge
            .map((committeePackageBridge) => ({
                isExpanded: true,
                data: {
                    entityName: committeePackageBridge.name,
                    entityId: committeePackageBridge.id
                },
                children: [
                    {
                        data: {
                            subheader: true
                        }
                    },
                    ...committeePackageBridge.ratings
                        .map((rating) => {
                            rating.recommendedReviewStatusLabel = this.getReviewStatusLabel(
                                rating.isOutlook,
                                rating.recommended.reviewStatus
                            );
                            rating.finalReviewStatusLabel = this.getReviewStatusLabel(
                                rating.isOutlook,
                                rating.final.reviewStatus
                            );

                            rating.finalized.voted = rating.finalized.voted ?? '-';

                            rating.recommendedRatingLabel = this.getRatingLabel(
                                rating.isLGD,
                                rating.recommended.rating
                            );
                            rating.finalRatingLabel = this.getRatingLabel(
                                rating.isLGD,
                                rating.isOutlook ? rating.final.outlook : rating.final.rating
                            );
                            return rating;
                        })
                        .filter(
                            (rating) =>
                                (rating.recommended.rating !== rating.final.rating &&
                                    rating.finalRatingLabel !== rating.recommendedRatingLabel) ||
                                rating.finalRatingLabel === '-'
                        )
                        .map((rating) => ({
                            data: { ...rating }
                        }))
                ]
            }))
            .filter((bridge) => bridge.children.length > 1);
    }

    onQuestionLink(link: string): void {
        this.questionLink.emit(link);
    }

    onAddBridge(data: CommitteePackageBridgeRating): void {
        this.addBridge.emit({
            committeePackage: this.getCommitteePackage(),
            committeePackageBridgeRating: data
        });
    }

    onAddAttendee(): void {
        //on save - update attendeesForm & packageDocuments
        const dialogRef = this.modalService.open(AddAttendeeModalComponent, {
            title: 'newCaseWarning.title',
            message: 'newCaseWarning.message',
            continueButtonTitle: 'newCaseWarning.createNewCase',
            closeButtonTitle: 'newCaseWarning.cancel',
            attendees: this.attendees,
            packageDocument: this.packageDocuments,
            add: (uploadedPackageDocument) => {
                const uploadedFiles = this.form.get('uploadedDocuments').get('support').value || [];
                uploadedFiles.push(uploadedPackageDocument);
                this.form.get('uploadedDocuments').get('support').setValue(uploadedFiles);
            },
            continue: (data) => {
                const attendeeIndex = this.attendees.value.findIndex((attendee) => attendee.id === data.attendee.id);
                if (attendeeIndex !== -1) {
                    const attendeeForm = this.attendees.at(attendeeIndex);
                    attendeeForm.get('isDeleted').setValue(false, { emitEvent: false });
                    attendeeForm.get('role').setValue('Select', { emitEvent: false });
                    attendeeForm.get('isInviteeDeleted').setValue(false, { emitEvent: false });

                    this.roleDropdowns.at(attendeeIndex).selectedValue = null;
                } else {
                    const attendee: Attendee = {
                        id: data.attendee.id,
                        firstName: data.attendee.firstName,
                        lastName: data.attendee.lastName,
                        title: data.attendee.title,
                        role: 'Select',
                        voted: true,
                        lineOfBusiness: data.attendee.lineOfBusiness,
                        selectedToVote: true,
                        eligibleToVote: true,
                        conflictStatus: ConflictStatus.Eligible,
                        isDeleted: false,
                        added: true,
                        initials: new ParticipantInitialsPipe().transform(
                            data.attendee.firstName + ' ' + data.attendee.lastName
                        )
                    };
                    this.addAttendee(attendee);
                    this.roleDropdowns.push({ selectedValue: null });
                }
                this.setAddendumQuestions();
                this._cdr.markForCheck();
                dialogRef.close();
            },
            close: () => {
                dialogRef.close();
            }
        });
    }

    public get currentQ8Reason(): string {
        return this.form.get('addendumQuestions.q8.reason').value;
    }
    public get currentQ8NewInviteeScenario(): string {
        return this.form.get('addendumQuestions.q8.newInviteeScenario').value;
    }
    onOpenAddRemoveQuestion(): void {
        this.openAddRemoveQuestion.emit({
            committeePackage: this.getCommitteePackage(),
            addendumQuestions: this.form.value.addendumQuestions           
        });
        this.setAddendumQuestions();
    }

    onAddendumQuestionChange(val: any): void {
        if (val !== '') {
            this.highlightAddendumQuestions.next(false);
        }
    }

    onRatingConductedInJapanChange(val: any): void {
        if (val === 'false') {
            this.isJapanAttendeeError$.next(false);
        }
        if (val !== null) {
            this.ratingConductedInJapanError$.next(false);
        }
        this.form.get('nonJapanBasedAnalystAttended').setValue(null, { emitEvent: false });
        this.resetJapanespecificQuestions();
    }

    onNonJapanBasedAnalystAttendedChange(val: any): void {
        if (val !== null) {
            this.nonJapanBasedAnalystAttendedError$.next(false);
        }
        if (val == 'false') {
            this.resetJapanespecificQuestions();
        }
    }

    resetJapanespecificQuestions(): void {
        const japanSpecificQuestionsArray = Object.keys(this.form.get('japanSpecificQuestionsFormGrp').value);
        japanSpecificQuestionsArray.forEach((question) => {
            this.form.get('japanSpecificQuestionsFormGrp').get(question)?.setValue(false, { emitEvent: false });
        });
    }

    onSave(isClose: boolean, redirectToWorklist = false): void {
        if (isClose) {
            this.isCloseClicked = true;
            this.closeClicked$.next(true);
        } else {
            this.saveClicked$.next(true);
        }
        if (this.isQ8CommentInvalid(isClose || this.saveClicked$.value)) {
        return;
    }

        if (this.shouldValidateOnSave(isClose)) {
            let validationError = this.validateCloseCommittee();
            validationError = this.validateCloseCommitteeMethodologies(validationError);
            validationError = validationError || !this.isBridgeValid();

            if (validationError) return;
        }

        if (isClose && this.validateVotesForEntityFromAUS()) return;
        if (this.isAdditionalRatingCommitteeInvalid()) return;
        if (this.isQ8ParticipantsInvalid(isClose)) return;
        if (this.isQ8CommentInvalid(isClose)) return;

        if (this.shouldShowAdditionalCommitteeDialog()) {
            this.openAdditionalCommitteeDialog(isClose);
            return;
        }

        this.saveCommitteeData(isClose, redirectToWorklist);
    }

    private shouldValidateOnSave(isClose: boolean): boolean {
        return isClose || this.form.getRawValue().additionalRatingCommittee === 'true';
    }

    private isAdditionalRatingCommitteeInvalid(): boolean {
        return this.form.getRawValue().additionalRatingCommittee === 'true' && this.numberOfCommittee === 3;
    }

    private isQ8ParticipantsInvalid(isClose: boolean): boolean {
        const addendumQuestionsGroup = this.form.get('addendumQuestions') as FormGroup;
        const q8Available = addendumQuestionsGroup.get('q8.available')?.value;
        const q8Reason = this.form.get('addendumQuestions.q8.reason').value;
        const participantsControl = this.form.get('addendumQuestions.q8.participants');
        if (
            isClose &&
            q8Available &&
            q8Reason === this.reasonForOverride.NewInviteeAdded &&
            (!participantsControl.value || participantsControl.value.length === 0)
        ) {
            participantsControl.markAsTouched();
            this.isCloseClicked = true;
            this.saveClicked$.next(true);
            return true;
        }
        return false;
    }

    private isQ8CommentInvalid(isSaveOrClose: boolean): boolean {
        const addendumQuestionsGroup = this.form.get('addendumQuestions') as FormGroup;
        const q8Available = addendumQuestionsGroup.get('q8.available')?.value;
        const q8Reason = this.form.get('addendumQuestions.q8.reason').value;
        const commentControl = this.form.get('addendumQuestions.q8.comment');
        if (
            isSaveOrClose &&
            q8Available &&
            (q8Reason === this.reasonForOverride.SuddenMarketEvent ||
                q8Reason === this.reasonForOverride.RatingErrorCorrection || 
                q8Reason === this.reasonForOverride.Other )
                &&
            (!commentControl.value || commentControl.value.trim() === '')
        ) {
            commentControl.markAsTouched();
            commentControl.setValue('', { emitEvent: false });
            const placeholder = this.getQ8CommentPlaceholder(q8Reason);
            this.additionalCommentPlaceholder$.next(placeholder);

            this.isCloseClicked = true;
            this.saveClicked$.next(true);
            return true;
        }
        return false;
    }

    private shouldShowAdditionalCommitteeDialog(): boolean {
        const formValue = this.form.getRawValue();
        return (
            formValue.additionalRatingCommittee === 'true' &&
            (this.numberOfCommittee === this.committeePackage.numberOfCommittees ||
                !this.committeePackage.numberOfCommittees)
        );
    }

    private openAdditionalCommitteeDialog(isClose: boolean): void {
        const dialogRef = this.modalService.open(AdditionalCommitteeConfirmationModalComponent, {
            title: AdditionalCommitteeConfirmationDialog.ExitTitle,
            acceptLabel: AdditionalCommitteeConfirmationDialog.ExitConfirmButton,
            dismissLabel: AdditionalCommitteeConfirmationDialog.NoActionButton,
            acceptFn: () => {
                this.saveCommitteeData(isClose, true);
            },
            dismissFn: () => {
                dialogRef.close();
            }
        });
    }

    saveCommitteeData(isClose: boolean, redirectToWorklist = false): void {
        this.showCancelModal = false;

        if (!isClose || this.isBridgeValid$.value) {
            this.save.emit({
                publications: this.publications,
                actionList: this.actionList,
                isClose,
                data: this.getCommitteePackage(),
                redirectToWorklist
            });
        }
        this.form.get('packageDocuments').setValue([]);
    }

    private validateCloseCommitteeMethodologies(validationError: boolean): boolean {
        if (
            this.actionList.length === 0 &&
            (this.showRatingCommitteeMethodologies || !this.filteredMethodologies?.length) &&
            (!this.ratingCommitteeMethodologySector ||
                !this.ratingCommitteeMethodologies ||
                !this.ratingCommitteeMethodologies.length)
        ) {
            this.showRatingCommitteeMethodologies = true;
            this.showRatingCommitteeMethodologiesError$.next(true);
            validationError = true;
        }
        return validationError;
    }

    private isCoverPageAndAnalyticalOrCompleteMissing(): boolean {
        const { uploadType, uploadedDocuments } = this.form.value;
        const files = this.committeePackageUploadedFiles;

        if (uploadType === UploadType.CoverPageAndAnlytical) {
            const isCoverPageMissing = !uploadedDocuments.coveragePage?.length && files.coveragePage.length === 0;
            const isAnalyticalMissing = !uploadedDocuments.analytical?.length && files.analytical.length === 0;

            return isCoverPageMissing || isAnalyticalMissing;
        }

        if (uploadType === UploadType.Complete) {
            return !uploadedDocuments.complete?.length && files.complete.length === 0;
        }

        return false;
    }

    get isCloseDisabled(): boolean {
        return this.isCoverPageAndAnalyticalOrCompleteMissing();
    }

    private validateCloseCommittee(): boolean {
        let validationError = false;

        if (this.isCoverPageAndAnalyticalOrCompleteMissing()) {
            validationError = true;
        }

        if (this.isPrRatingRationaleInvalid()) {
            validationError = true;
        }
        if (this.isCreditSfIndicatorInvalid()) {
            validationError = true;
        }

        if (this.isKFEChangeInvalid()) {
            this.showKFEError.next(true);
            validationError = true;
        }
        
        let addendumQuestionsValid = this.validateAddendumQuestions();
        if (!addendumQuestionsValid) {
            this.highlightAddendumQuestions.next(true);
            validationError = true;
        }

        if (!this.isJapanSpecificQuestionsValid()) {
            this.showJapanSpecificQuestionsError.next(true);
            validationError = true;
        }

        if (this.isRoleValidationFailed()) {
            this.showRolesError.next(true);
            validationError = true;
        }

        if (this.isAdditionalRatingCommittee()) {
            this.additionalRatingCommittee$.next(true);
            validationError = true;
        }

        if (this.isVoterConfirmationChanged()) {
            validationError = true;
        }

        validationError = this.validateQuestionsData(validationError);

        if (this.isRatingConductedInJapan()) {
            validationError = true;
        }

        if (this.isJapanAttendeeAvailable()) {
            validationError = true;
        }

        if (this.isVotedSelectedMinimumThree()) {
            this.minimumThreeAttendeesVote$.next(true);
            validationError = true;
        }
        

        return validationError;
    }

    private validateQuestionsData(validationError){
        if (this.form.get('keyFactualElementChanged').value === undefined) {
            this.keyFactualElementChanged$.next(true);
            this.questionsData[0].isError = true;
            validationError = true;
        }

        if (this.form.get('esgConsiderationChanged').value === undefined) {
            this.esgConsiderationChanged$.next(true);
            this.questionsData[1].isError = true;
            validationError = true;
        }

        if (this.form.get('prRatingRationaleChanged').value === undefined) {
            this.prRatingRationaleChanged$.next(true);
            this.questionsData[2].isError = true;
            validationError = true;
        }

        if (this.form.get('creditSfIndicatorChanged').value === undefined) {
            this.creditSfIndicatorChanged$.next(true);
            if(this.isRatingGroupTypeSovereign()){
                this.questionsData[3].isError = true;
            }else{
                this.questionsData[5].isError = true;
            }
            validationError = true;
        }

        if (this.form.get('creditSfIndicatorChanged').value === 'true') {
             if (!this.form.get('sfUnratedAssets').value) {
                this.sfFollowupQuestionsData[0].isError = true;
                validationError = true;
            }
            if (!this.form.get('sfNotchDifference').value) {
                this.sfFollowupQuestionsData[0].isError = true;
                validationError = true;
            }
        }
        if (this.form.get('sfUnratedAssets').value === 'true' && !this.form.get('sfUnratedAssetsTreatment').value) {
                validationError = true;
        }



        return validationError;
    }

    private validateAddendumQuestions(){
        const addendumQuestionsGroup = this.form.get('addendumQuestions') as FormGroup;
        let addendumQuestionsValid = true;
        Object.keys(addendumQuestionsGroup.controls).forEach((key) => {
            const questionGroup = addendumQuestionsGroup.get(key) as FormGroup;
            if (questionGroup?.get('available')?.value && questionGroup?.invalid) {
                addendumQuestionsValid = false;
            }
        });
        return addendumQuestionsValid;
    }

    private isVotedSelectedMinimumThree(): boolean {
        const roles = this.getValidRoles();
        const roleSelections = this.getRoleSelections(roles);

        let validRoles = this.validateMandatoryRoles(roleSelections);
            

        const eligibleAttendees = this.attendees.controls.filter(
            (attendee) => !['INELIGIBLE', 'UNKNOWN'].includes(attendee.get('conflictStatus').value)
        );

        const isAustAttendeePresent = eligibleAttendees.some((attendee) => attendee.get('country').value === 'AUS');

        if (!isAustAttendeePresent) {
            const noOfVotedCount = eligibleAttendees.filter(
                (attendee) => attendee.get('voted').value === true && !attendee.get('isDeleted').value
            ).length;

            if (validRoles && noOfVotedCount < 3) {
                this.minimumThreeAttendeesVote$.next(true);
                return true;
            }
        }

        this.minimumThreeAttendeesVote$.next(false);
        return false;
    }

    validateMandatoryRoles(roleSelections){
        return (roleSelections.isLeadAnalystSelected &&
            roleSelections.isPACRSelected &&
            (roleSelections.isRCChairSelected || roleSelections.isPACR_Served_as_RC_ChairSelected)) ||
        (roleSelections.isLeadAnalystNonAttendeeSelected &&
            roleSelections.isPACRSelected &&
            (roleSelections.isRCChairSelected || roleSelections.isPACR_Served_as_RC_ChairSelected)) ||
        (roleSelections.isLeadAnalystNonAttendeeSelected &&
            roleSelections.isPACRNonAttendeeSelected &&
            (roleSelections.isRCChairSelected || roleSelections.isPACR_Served_as_RC_ChairSelected)) ||
        (roleSelections.isLeadAnalystSelected &&
            roleSelections.isPACRNonAttendeeSelected &&
            (roleSelections.isRCChairSelected || roleSelections.isPACR_Served_as_RC_ChairSelected)) ||
        (roleSelections.isLeadAnalystSelected && roleSelections.isPACR_Served_as_RC_ChairSelected) ||
        (roleSelections.isLeadAnalystNonAttendeeSelected && roleSelections.isPACR_Served_as_RC_ChairSelected);
    }

    private validateVotesForEntityFromAUS(): boolean {
        if (this.isEntityFromAUS) {
            this.numberOfVotes = this.attendeesFormArrayControls.reduce((voteCount, control) => {
                const attendee = control.value;
                return !attendee.isDeleted && attendee.conflictStatus === 'ELIGIBLE' && attendee.voted
                    ? voteCount + 1
                    : voteCount;
            }, 0);

            if (this.numberOfVotes < 4) {
                return true;
            }
            return false;
        }
        return false;
    }

    private isJapanAttendeeAvailable(): boolean {
        let isFlag = false;
        this.attendees.controls.forEach((ctrl) => {
            if (this.form.get('ratingConductedInJapan').value === 'true') {
                if (
                    ctrl.get('country').value === 'JPN' &&
                    (ctrl.get('conflictStatus').value === this.conflictStatus.Eligible ||
                        ctrl.get('conflictStatus').value === this.conflictStatus.EligibleCantVote)
                ) {
                    if (
                        ctrl.get('role').value === ParticipantRoleEnum.LeadAnalyst ||
                        ctrl.get('role').value === ParticipantRoleEnum.LeadAnalystNonAttendee
                    ) {
                        this.isJapanAttendeeError$.next(false);
                    } else {
                        this.isJapanAttendeeError$.next(true);
                        isFlag = true;
                    }
                }
            }
        });
        return isFlag;
    }

    private displayJapanQuestion(): boolean {
        let isFlag = false;
        this.attendees.controls.forEach((ctrl) => {
            if (
                ctrl.get('country').value === 'JPN' &&
                (ctrl.get('conflictStatus').value === this.conflictStatus.Eligible ||
                    ctrl.get('conflictStatus').value === this.conflictStatus.EligibleCantVote)
            ) {
                isFlag = true;
            }
        });
        return isFlag;
    }

    private isRatingConductedInJapan(): boolean {
        let isFlag = false;

        if (!this.showJapanQuestion && this.form.get('ratingConductedInJapan').value === null) {
            this.ratingConductedInJapanError$.next(false);
        } else if (this.showJapanQuestion && this.form.get('ratingConductedInJapan').value === null) {
            this.ratingConductedInJapanError$.next(true);
            isFlag = true;
        }

        if (
            this.form.get('ratingConductedInJapan').value === 'true' &&
            this.form.get('nonJapanBasedAnalystAttended').value === null
        ) {
            this.nonJapanBasedAnalystAttendedError$.next(true);
            isFlag = true;
        }

        return isFlag;
    }

    private isAdditionalRatingCommittee(): boolean {
        const arCommittee = this.form.get('additionalRatingCommittee');
        if (arCommittee.untouched && arCommittee.value === null) {
            return true;
        } else if (arCommittee.dirty && arCommittee.value !== null) {
            return false;
        }
    }

    private isVoterConfirmationChanged(): boolean {
    const voterConfirmation = this.form.get('voterConfirmation');
    const additionalRatingCommittee = this.form.get('additionalRatingCommittee')?.value;
    return (
        (voterConfirmation.value === 'false' || voterConfirmation.value === null) &&
        (this.form.value.otherComments === undefined ||
            this.form.value.otherComments === null ||
            this.form.value.otherComments === '') &&
        additionalRatingCommittee !== 'false' 
    );
}

    private isPrRatingRationaleInvalid(): boolean {
        const prRatingRationaleToggle = this.form.get('prRatingRationaleChanged').value;
        if (prRatingRationaleToggle === 'true') {
            const prRatingRationaleComment = this.form.get('prRatingRationaleComment').getRawValue();
            if (undefined === prRatingRationaleComment || prRatingRationaleComment === '') {
                this.showRatingRationaleError.next(true);
                return true;
            }
        }
        this.showRatingRationaleError.next(false);
        return false;
    }

    private isCreditSfIndicatorInvalid(): boolean {
        const creditSfIndicatorToggle = this.form.get('creditSfIndicatorChanged').value;
        let isInvalid = false;
        if (creditSfIndicatorToggle === 'true') {
            
            
            isInvalid = this.validateSfUnratedAssets(isInvalid);
            isInvalid = this.validateSfNotchDifference(isInvalid);
            
            
            
        }
        return isInvalid;
    }

    validateSfUnratedAssets(isInvalid){
        const sfUnratedAssets = this.form.get('sfUnratedAssets').getRawValue();
        if (undefined === sfUnratedAssets || sfUnratedAssets === '' || sfUnratedAssets==null) {
            this.showSfUnratedAssetsError.next(true);
            isInvalid = true;
        }
        else if(sfUnratedAssets==='true'){
            isInvalid = this.validateSfUnratedAssetsTreatment(isInvalid);
            
        }
        return isInvalid;
    }

    validateSfNotchDifference(isInvalid){
        const sfNotchDifference = this.form.get('sfNotchDifference').getRawValue();
        if (undefined === sfNotchDifference || sfNotchDifference === '' || sfNotchDifference==null) {
            this.showSfNotchDifferenceError.next(true);
            isInvalid = true;
        }else if(sfNotchDifference==='true'){
            const sfIndicatorNotchReasonListLength = this.sfIndicatorNotchReasonList.filter((reason)=> reason.changed === true).length;
            if(sfIndicatorNotchReasonListLength===0){
                this.showSfNotchDifferenceReasonsError.next(true);
                isInvalid = true;
            }else{
                this.showSfNotchDifferenceReasonsError.next(false);
            }
        }
        return isInvalid;
    }

    validateSfUnratedAssetsTreatment(isInvalid){
        const sfUnratedAssetsTreatment = this.form.get('sfUnratedAssetsTreatment').getRawValue();
            if (undefined === sfUnratedAssetsTreatment || sfUnratedAssetsTreatment === '' || sfUnratedAssetsTreatment==null) {
                this.showSfUnratedAssetsTreatmentError.next(true);
                isInvalid = true;
            } else {
                this.showSfUnratedAssetsTreatmentError.next(false);

                if(sfUnratedAssetsTreatment==='true') {
                    const len = this.sfIndicatorReasonList.filter((reason)=> reason.changed===true).length;
                    if(len === 0) {
                        this.showSfUnratedAssetsReasonsError.next(true);
                        isInvalid = true;
                    }
                    else{
                        this.showSfUnratedAssetsReasonsError.next(false);
                    }
                }
            }
        return isInvalid;
    }

    isJapanSpecificQuestionsValid(): boolean {
        const japanSpecificQuestionsArray = Object.values(this.form.get('japanSpecificQuestionsFormGrp').value);
        if (
            this.form.get('ratingConductedInJapan').value === 'true' &&
            this.form.get('nonJapanBasedAnalystAttended').value === 'true' &&
            !japanSpecificQuestionsArray.some((val) => val === true)
        ) {
            return false;
        }
        return true;
    }

    onJapanSpecificQuestionsCheck(): void {
        const japanSpecificQuestionsArray = Object.values(this.form.get('japanSpecificQuestionsFormGrp').value);
        if (japanSpecificQuestionsArray.some(Boolean)) {
            this.showJapanSpecificQuestionsError.next(false);
        } else {
            this.showJapanSpecificQuestionsError.next(true);
        }
    }

    getCommitteePackage(): CommitteePackage {
        const {
            keyFactualElementChanged,
            keyFactualElementComment,
            esgConsiderationChanged,
            esgConsiderationComment,
            prRatingRationaleChanged,
            prRatingRationaleComment,
            finalScorecardChanged,
            initialScorecardChanged,
            creditSfIndicatorChanged,
            sfUnratedAssets,
            sfNotchDifference,
            otherNotchReasonComment,
            sfUnratedAssetsTreatment,
            attendees,
            ratingConductedInJapan,
            nonJapanBasedAnalystAttended,
            japanSpecificQuestionsFormGrp,
            additionalRatingCommittee,
            voterConfirmation,
            uploadType
        } = this.form.getRawValue();

        let additionalRatingCommitteeData =
            additionalRatingCommittee == null ? additionalRatingCommittee : additionalRatingCommittee === 'true';
        const voterConfirmationData = voterConfirmation == null ? voterConfirmation : voterConfirmation === 'true';

        const formUploadedDocuments = this.form.value.uploadedDocuments;
        const packageDocuments = [...this.committeePackageUploadedFiles.support];
        const uploadedFiles = [];

        if (this.committeePackage.packageDocuments) {
            packageDocuments.push(
                ...this.committeePackage.packageDocuments.filter(
                    (doc) => doc.ratingCommitteeNumber !== this.numberOfCommittee
                )
            );
        }
        if (formUploadedDocuments.support) {
            const files = formUploadedDocuments.support.map((file) => ({
                ...file,
                docType: PackageDocType.SUPPORTING_DOCS
            }));
            uploadedFiles.push(...files);
        }

        if (uploadType === UploadType.CoverPageAndAnlytical) {
            if (formUploadedDocuments.coveragePage) {
                const files = formUploadedDocuments.coveragePage.map((file) => ({
                    ...file,
                    docType: PackageDocType.RCM_COVER_PAGE
                }));
                uploadedFiles.push(...files);
            }
            if (formUploadedDocuments.analytical) {
                const files = formUploadedDocuments.analytical.map((file) => ({
                    ...file,
                    docType: PackageDocType.RATING_COMMITTEE_MEMO
                }));
                uploadedFiles.push(...files);
            }

            packageDocuments.push(
                ...this.committeePackageUploadedFiles.coveragePage,
                ...this.committeePackageUploadedFiles.analytical
            );
        } else if (uploadType === UploadType.Complete) {
            if (formUploadedDocuments.complete) {
                const files = formUploadedDocuments.complete.map((file) => ({
                    ...file,
                    docType: PackageDocType.RATING_COMMITTEE_PACKAGE
                }));
                uploadedFiles.push(...files);
            }
            packageDocuments.push(...this.committeePackageUploadedFiles.complete);
        }

        return {
            id: this.committeePackage?.id,
            keyFactualElementChanged: {
                changed: keyFactualElementChanged,
                comment: keyFactualElementComment
            },
            esgConsiderationChanged: {
                changed: esgConsiderationChanged,
                comment: esgConsiderationComment
            },
            prRatingRationaleChanged: {
                changed: prRatingRationaleChanged,
                comment: prRatingRationaleComment
            },
            finalScorecardChanged: { changed: finalScorecardChanged },
            initialScorecardChanged: { changed: initialScorecardChanged },
            creditSfIndicatorChanged: { changed: creditSfIndicatorChanged },
            sfUnratedAssets: { changed: sfUnratedAssets },
            sfNotchDifference: { changed: sfNotchDifference,
                comment: otherNotchReasonComment,
                reasons: this.sfIndicatorNotchReasonList
             },
            sfUnratedAssetsTreatment: { changed: sfUnratedAssetsTreatment,
                reasons: this.sfIndicatorReasonList
             },
            addendumQuestions: this.getAddendumQuestionsFromForm(),
            bridge: this.committeePackage?.bridge,
            attendees: attendees,
            comments: this.form.value.otherComments,
            packageDocuments: packageDocuments,
            uploadedFiles: uploadedFiles,
            closeCommitteeJapanQuestions:
                ratingConductedInJapan == null ? ratingConductedInJapan : ratingConductedInJapan == 'true',
            nonJapanBasedAnalystAttended:
                nonJapanBasedAnalystAttended == null
                    ? nonJapanBasedAnalystAttended
                    : nonJapanBasedAnalystAttended == 'true',
            japanSpecificQuestions: Object.keys(japanSpecificQuestionsFormGrp).filter(
                (key) => japanSpecificQuestionsFormGrp[key]
            ),
            hasHongkongSingaporeInvitee: this.committeePackage?.hasHongkongSingaporeInvitee,
            keyFactualElements: this.keyFactualElements,
            additionalRatingCommittee: additionalRatingCommitteeData,
            voterConfirmation: voterConfirmationData,
            methodologies: this.ratingCommitteeMethodologies,
            numberOfCommittees: this.committeePackage?.numberOfCommittees,
            methodologySector: this.ratingCommitteeMethodologySector
        };
    }

    getAddendumQuestionsFromForm(): AddendumQuestion[] {
        const addendumQuestions: AddendumQuestion[] = [];
        this.questions.forEach((question) => {
            if (this.form.getRawValue().addendumQuestions[CommitteeReason[question]].available) {
                const addendumQuestion = {
                    key: CommitteeReason[question],
                    reason: this.form.value.addendumQuestions[CommitteeReason[question]].reason
                };

                if (question == ReasonsForDeny.INELIGIBLE_START) {
                    Object.assign(addendumQuestion, {
                        newInviteeScenario:
                            this.form.value.addendumQuestions[CommitteeReason[question]].newInviteeScenario,
                        specializedExpertise:
                            this.form.value.addendumQuestions[CommitteeReason[question]].specializedExpertise,
                        comment: this.form.value.addendumQuestions[CommitteeReason[question]].comment,
                        participants: this.form.value.addendumQuestions[CommitteeReason[question]].participants
                    });
                }

                addendumQuestions.push(addendumQuestion);
            }
        });

        return addendumQuestions;
    }

    private setOtherComments() {
        this.form.get('otherComments')?.setValue(this.committeePackage?.comments, { emitEvent: false });
    }

    onCancel() {
        if (this.showCancelModal) {
            const modalRef = this.modalService.open(CancelConfirmationModalComponent, {
                showGeneralMessage: true,
                acceptFn: () => {
                    this.casesService.router.navigateByUrl(AppRoutes.WORK_LIST);
                },
                dismissFn: () => {
                    modalRef.close();
                }
            });
        } else {
            this.casesService.router.navigateByUrl(AppRoutes.WORK_LIST);
        }
    }

    onBack() {
        this.navToBackHandler.emit();
    }

    onNext() {
        this.navToNextHandler.emit();
    }

    onFileRemove(fileToRemove: any, docType: PackageDocType) {
        fileToRemove.isDeleted = true;
        let files = [];

        switch (docType) {
            case PackageDocType.RCM_COVER_PAGE:
                files = this.committeePackageUploadedFiles.coveragePage;
                break;
            case PackageDocType.RATING_COMMITTEE_MEMO:
                files = this.committeePackageUploadedFiles.analytical;
                break;
            case PackageDocType.RATING_COMMITTEE_PACKAGE:
                files = this.committeePackageUploadedFiles.complete;
                break;
            case PackageDocType.SUPPORTING_DOCS:
                files = this.committeePackageUploadedFiles.support;
                break;
        }

        const index = files.findIndex((uploadedFile) => uploadedFile.refId === fileToRemove.refId);
        if (index > -1) {
            files.splice(index, 1);
        }
    }

    onAdditionRatingCommitteeChange() {
        this.additionalRatingCommittee$.next(false);
    }

    onVoterConfirmationChange(value: boolean) {
        this.voterConfirmation$.next(value);
    }

    onKeyFactualElementsChange(keyFactualElements: KeyFactualElement[]) {
        this.keyFactualElements = keyFactualElements;
        if (this.keyFactualElements[0].value !== undefined && this.keyFactualElements[0]?.dataSources?.length > 0) {
            this.showKFEError.next(false);
        }
    }

    private setUploadDocuments(packageDocuments: any[] = []) {
        packageDocuments =
            packageDocuments?.filter((doc) => doc.ratingCommitteeNumber === this.numberOfCommittee) || [];
        this.committeePackageUploadedFiles.coveragePage = packageDocuments?.filter(
            (doc) => doc.type === PackageDocType.RCM_COVER_PAGE
        );
        this.committeePackageUploadedFiles.analytical = packageDocuments?.filter(
            (doc) => doc.type === PackageDocType.RATING_COMMITTEE_MEMO
        );
        this.committeePackageUploadedFiles.complete = packageDocuments?.filter(
            (doc) => doc.type === PackageDocType.RATING_COMMITTEE_PACKAGE
        );
        this.committeePackageUploadedFiles.support = packageDocuments?.filter(
            (doc) => doc.type === PackageDocType.SUPPORTING_DOCS
        );
    }

    private setAdditionalRatingCommittee() {
        if (
            this.committeePackage?.additionalRatingCommittee !== undefined &&
            this.committeePackage?.additionalRatingCommittee !== null
        ) {
            this.form
                .get('additionalRatingCommittee')
                ?.setValue(this.committeePackage?.additionalRatingCommittee ? 'true' : 'false', {
                    emitEvent: false
                });
        }
    }

    private setUploadType() {
        this.form
            .get('uploadType')
            ?.setValue(
                this.committeePackageUploadedFiles.complete.length > 0
                    ? UploadType.Complete
                    : UploadType.CoverPageAndAnlytical,
                {
                    emitEvent: false
                }
            );
    }

    private setVoterConfirmartion() {
        if (
            this.committeePackage?.voterConfirmation !== undefined &&
            this.committeePackage?.voterConfirmation !== null
        ) {
            this.form.get('voterConfirmation')?.setValue(this.committeePackage?.voterConfirmation ? 'true' : 'false', {
                emitEvent: false
            });
        }
    }

    private setJapanSpecificQuestions() {
        if (
            this.committeePackage?.closeCommitteeJapanQuestions !== undefined &&
            this.committeePackage?.closeCommitteeJapanQuestions !== null
        ) {
            this.form
                .get('ratingConductedInJapan')
                ?.setValue(this.committeePackage?.closeCommitteeJapanQuestions ? 'true' : 'false', {
                    emitEvent: false
                });
        }

        if (
            this.committeePackage?.nonJapanBasedAnalystAttended !== undefined &&
            this.committeePackage?.nonJapanBasedAnalystAttended !== null
        ) {
            this.form
                .get('nonJapanBasedAnalystAttended')
                ?.setValue(this.committeePackage?.nonJapanBasedAnalystAttended ? 'true' : 'false', {
                    emitEvent: false
                });
        }

        if (
            this.committeePackage?.japanSpecificQuestions !== undefined &&
            this.committeePackage?.japanSpecificQuestions !== null
        ) {
            this.committeePackage?.japanSpecificQuestions.forEach((question) => {
                this.form.get('japanSpecificQuestionsFormGrp').get(question)?.setValue(true, { emitEvent: false });
            });
        }
    }

    getFilteredRoles(index: number) {
        let selectedValues = this.roleDropdowns.filter((_, i) => i !== index).map((dropdown) => dropdown.selectedValue);
        this.showMultipleLeadAnalystNote =
            this.roleDropdowns.filter(
                ({ selectedValue }) =>
                    selectedValue === ParticipantRoleEnum.LeadAnalyst ||
                    selectedValue === ParticipantRoleEnum.LeadAnalystNonAttendee
            ).length > 1;

        this.showMultiplePACRNote =
            this.roleDropdowns.filter(
                ({ selectedValue }) =>
                    selectedValue === ParticipantRoleEnum.PACRAttendee ||
                    selectedValue === ParticipantRoleEnum.PACRNonAttendee ||
                    selectedValue === ParticipantRoleEnum.PACR_RC_CHAIR
            ).length > 1;

        if (selectedValues.includes(ParticipantRoleEnum.PACR_RC_CHAIR)) {
            selectedValues.push(ParticipantRoleEnum.Chair);
        }
        if (
            selectedValues.includes(ParticipantRoleEnum.PACRAttendee) &&
            selectedValues.includes(ParticipantRoleEnum.Chair)
        ) {
            selectedValues.push(ParticipantRoleEnum.PACR_RC_CHAIR);
        }
        selectedValues = selectedValues.filter(
            (value) =>
                value !== ParticipantRoleEnum.CommitteeAttendee &&
                value !== ParticipantRoleEnum.LeadAnalyst &&
                value !== ParticipantRoleEnum.LeadAnalystNonAttendee
        );
        if (
            [
                ParticipantRoleEnum.PACRAttendee,
                ParticipantRoleEnum.PACRNonAttendee,
                ParticipantRoleEnum.PACR_RC_CHAIR
            ].some((role) => selectedValues.includes(role))
        ) {
            selectedValues.push(
                ParticipantRoleEnum.PACRAttendee,
                ParticipantRoleEnum.PACRNonAttendee,
                ParticipantRoleEnum.PACR_RC_CHAIR
            );
        }

        return this.roles.filter((option) => !selectedValues.includes(option.value));
    }

    updateDropdownOptions(dropdown, value, index) {
        dropdown.selectedValue = value;
        this.disableVotedAndAttendedIfNeeded(value, index);
        if (this.isCloseClicked || this.saveClicked$.value) {
            if (this.isRoleValidationFailed()) {
                this.showRolesError.next(true);
            } else {
                if (
                    this.attendees.at(index).get('country').value === 'JPN' &&
                    (value === ParticipantRoleEnum.LeadAnalyst ||
                        value === ParticipantRoleEnum.LeadAnalystNonAttendee) &&
                    (this.attendees.at(index).get('conflictStatus').value === this.conflictStatus.Eligible ||
                        this.attendees.at(index).get('conflictStatus').value === this.conflictStatus.EligibleCantVote)
                ) {
                    this.isJapanAttendeeError$.next(false);
                }
                this.showRolesError.next(false);
            }
        }
    }

    private disableVotedAndAttendedIfNeeded(value, index) {
        /**
         * @desciption
         * If user selects PACR Non-Attendee and Lead Analyst Non Attendee they system should display Selected to Vote default to No
         */
        if (value === ParticipantRoleEnum.LeadAnalystNonAttendee || value === ParticipantRoleEnum.PACRNonAttendee) {
            this.attendees.at(index).get('voted')?.setValue(false, { emitEvent: false });
            this.attendees.at(index).get('voted')?.disable({ emitEvent: false });

            this.attendees.at(index).get('attendedCommittee')?.setValue(false, { emitEvent: false });
            this.attendees.at(index).get('attendedCommittee')?.disable({ emitEvent: false });

            this.attendees.at(index).get('eligibleToVote')?.setValue(false, { emitEvent: false });

            this.attendees.at(index).get('selectedToVote')?.setValue(false, { emitEvent: false });
            this.attendees.at(index).get('selectedToVote')?.disable({ emitEvent: false });
        } else {
            this.attendees.at(index).get('attendedCommittee')?.enable({ emitEvent: false });
            this.attendees
                .at(index)
                .get('eligibleToVote')
                ?.setValue(
                    this.attendees.at(index).value.conflictStatus === this.conflictStatus.Eligible ||
                        this.attendees.at(index).value.conflictStatus === this.conflictStatus.EligibleCantVote,
                    { emitEvent: false }
                );

            this.attendees.at(index).get('selectedToVote')?.enable({ emitEvent: false });

            if (this.attendees.at(index).get('selectedToVote').value) {
                this.attendees.at(index).get('voted')?.enable({ emitEvent: false });
            }
        }
    }

    showTooltip: boolean;
    isRoleValidationFailed(): boolean {
        const roles = this.getValidRoles();
        let validationFailed = false;
        if (roles.some((role) => role === DEFAULT_ROLE_VALUE)) {
            validationFailed = true;
        } else {
            /**
             * @description Lead Analyst, PACR, RC Chair to proceed.
             * Lead Analyst: LeadAnalyst, LeadAnalystNonAttendee
             * RC Chair: RatingCommitteeChair, Chair, PACR_RC_CHAIR=>(PACR & RC Chair)
             * PACR: PACRAttendee, PACRNonAttendee, PACR_RC_CHAIR,
             * Committee Attendee: CommitteeAttendee
             */

            const roles = this.getValidRoles();
            const roleSelections = this.getRoleSelections(roles);
            validationFailed = this.updateRoleSelections(roleSelections);
        }

        return validationFailed;
    }

    private getValidRoles(): string[] {
        return Array.from(
            this.form
                .get('attendees')
                .getRawValue()
                .filter(
                    (attendee) =>
                        !attendee.isDeleted &&
                        !attendee.isInviteeDeleted &&
                        (attendee.conflictStatus === this.conflictStatus.Eligible ||
                            attendee.conflictStatus === this.conflictStatus.EligibleCantVote)
                )
                .map((attendee) => attendee.role)
        );
    }

    private getRoleSelections(roles: string[]): any {
        const isPACR_Served_as_RC_ChairSelected = roles.includes(ParticipantRoleEnum.PACR_RC_CHAIR);
        const isRCChairSelected =
            roles.includes(ParticipantRoleEnum.RatingCommitteeChair) ||
            roles.includes(ParticipantRoleEnum.Chair) ||
            isPACR_Served_as_RC_ChairSelected;
        const isPACRSelected = roles.includes(ParticipantRoleEnum.PACRAttendee);
        const isLeadAnalystSelected = roles.includes(ParticipantRoleEnum.LeadAnalyst);
        const isPACRNonAttendeeSelected = roles.includes(ParticipantRoleEnum.PACRNonAttendee);
        const isCommitteeAttendeeSelected = roles.includes(ParticipantRoleEnum.CommitteeAttendee);
        const isLeadAnalystNonAttendeeSelected = roles.includes(ParticipantRoleEnum.LeadAnalystNonAttendee);

        return {
            isPACR_Served_as_RC_ChairSelected,
            isRCChairSelected,
            isPACRSelected,
            isLeadAnalystSelected,
            isPACRNonAttendeeSelected,
            isCommitteeAttendeeSelected,
            isLeadAnalystNonAttendeeSelected
        };
    }

    private updateRoleSelections(roleSelections: any): boolean {
        let validationFailed = false;
        const isLeadAnalystPresent =
            roleSelections.isLeadAnalystSelected || roleSelections.isLeadAnalystNonAttendeeSelected;
        const isPACRWithRCChair =
            (roleSelections.isPACRSelected || roleSelections.isPACRNonAttendeeSelected) &&
            roleSelections.isRCChairSelected;
        const isPACRServedAsRCChair = roleSelections.isPACR_Served_as_RC_ChairSelected;

        this.showTooltip = !(isLeadAnalystPresent && (isPACRWithRCChair || isPACRServedAsRCChair));

        validationFailed = this.showTooltip;

        return validationFailed;
    }

    onToggleChange(field: string, value: string) {
        if (field === 'prRatingRationaleChanged' && value === 'false') {
            this.showRatingRationaleError.next(false);
        }
        if (field === 'keyFactualElementChanged' && value === 'false') {
            this.showKFEError.next(false);
        }
        this.sfIndicatorToggglechanges(field, value);
        if (field === 'keyFactualElementChanged') {
            this.questionsData[0].isError = false;
            this.keyFactualElementChanged$.next(false);
        }
        if (field === 'esgConsiderationChanged') {
            this.questionsData[1].isError = false;
            this.esgConsiderationChanged$.next(false);
        }

        if (field === 'prRatingRationaleChanged') {
            this.questionsData[2].isError = false;
            this.prRatingRationaleChanged$.next(false);
        }

        if (field === 'creditSfIndicatorChanged') {
            if(this.isRatingGroupTypeSovereign()){
            this.questionsData[3].isError = false;
            }else{
                this.questionsData[5].isError = false;
            }
            this.creditSfIndicatorChanged$.next(false);

            if(value==="false"){
                this.showSfUnratedAssetsError.next(false);
                this.showSfNotchDifferenceError.next(false);

                this.resetReasonList();
                this.resetNotchReasonList();
            }
        }
    }

    resetReasonList(){
        this.sfIndicatorReasonList = [
            {
                    "reason": SFIndicatorReasonType.MULTIPLE_CR,
                    "changed": false
                },
                {
                    "reason": SFIndicatorReasonType.CREDIT_ESTIMATES,
                    "changed": false
                },
                {
                    "reason": SFIndicatorReasonType.CREDIT_ANALYSIS,
                    "changed": false
                },
                {
                    "reason": SFIndicatorReasonType.APPLY_NOTCHING,
                    "changed": false
                }
    
        ];
    }
    
    resetNotchReasonList(){
        this.sfIndicatorNotchReasonList = [
            {
                "reason": SFIndicatorReasonType.MULTIPLE_SCENARIOS,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.METHODOLOGY_RATING_CAP_APPLIED,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.DIFFERENT_DEAL_PERFORMANCE,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.SERVICE_ADJUSTMENT_APPLIED,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.TIME_TO_MATURITY_ADJUSTMENT_APPLIED,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.THIRD_PARTY_DEPENDENCY_NOT_ADDRESSED,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.BENCH_MARKING_ADJUSTMENT_APPLIED,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.DEAL_LEVEL_NOT_ADDRESSED,
                "changed": false
            },
            {
                "reason": SFIndicatorReasonType.OTHER,
                "changed": false
            }
    
    ];
    }
    sfIndicatorToggglechanges(field:string, value: string){
        if (field === 'sfUnratedAssets') {
            this.showSfUnratedAssetsError.next(false);
            if(value=="false"){
                this.resetReasonList();
                this.showSfUnratedAssetsTreatmentError.next(false);
            }
        }
        if(field === 'sfUnratedAssetsTreatment'){
            this.showSfUnratedAssetsTreatmentError.next(false);
            if(value==='false'){
                this.resetReasonList();
                this.showSfUnratedAssetsReasonsError.next(false);
            }
        }
        if (field === 'sfNotchDifference') {
            this.showSfNotchDifferenceError.next(false);
            if(value==='false'){
                this.resetNotchReasonList();
                this.form
                    .get('otherNotchReasonComment')
                    ?.setValue('');
                this.showSfNotchDifferenceReasonsError.next(false);
            }
        }

    }

    selectedMethodologies(selectedMethodologies: MethodologyData[]) {
        this.ratingCommitteeMethodologies = selectedMethodologies;
        this.showRatingCommitteeMethodologiesError$.next(false);
        if (this.ratingCommitteeMethodologySector) {
            this.showRatingCommitteeMethodologiesError$.next(false);
        }
    }

    selectedSector(selectedSector: string) {
        this.ratingCommitteeMethodologySector = selectedSector;
        if (this.ratingCommitteeMethodologies) {
            this.showRatingCommitteeMethodologiesError$.next(false);
        }
    }

    private isKFEChangeInvalid() {
        let isKFEChangeInvalid = false;
        const keyFactualToggle = this.form.get('keyFactualElementChanged').value;
        if (keyFactualToggle === 'true') {
            if (this.keyFactualElements[0]?.value === undefined || this.keyFactualElements[0]?.value === 'undefined') {
                isKFEChangeInvalid = true;
                this.kfeKeyFactualError.next();
            }
            if (
                this.keyFactualElements[0]?.dataSources?.length === undefined ||
                this.keyFactualElements[0]?.dataSources?.length === 0
            ) {
                isKFEChangeInvalid = true;
                this.kfeDataSourceError.next();
            }
        }
        return isKFEChangeInvalid;
    }


}

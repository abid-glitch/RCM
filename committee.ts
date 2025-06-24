import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Inject,
    Input,
    OnChanges,
    OnDestroy,
    Output,
    SimpleChanges,
    ViewChild
} from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { COMMITTEE_PACKAGE_STEPS } from '@committeePackage/repository/services/committee-package';
import { StepPermission } from '@committeePackage/shared/enums/component-permission.enum';
import { StepPermissionService } from '@committeePackage/shared/services/step-permission/step-permission.service';
import { VoteTally } from '@app/vote/enums/vote-tally.enum';
import { CustomRatingClass, CustomRatingClassState, EntityRating } from '@app/vote/models/entity-rating';
import { FinalRating, Rating } from '@app/vote/models/rating';
import { RatingCommitteeVote, RatingCommitteeVoteData } from '@app/vote/models/rating-committee-vote';
import {
    BlueModalService,
    BluePopoverEvent,
    BlueTableCheckboxScope,
    BlueTableData,
    BlueTypeahead
} from '@moodys/blue-ng';
import {
    BehaviorSubject,
    combineLatest,
    defer,
    EMPTY,
    filter,
    map,
    merge,
    Observable,
    of,
    startWith,
    Subject,
    switchMap,
    takeUntil,
    tap,
    withLatestFrom
} from 'rxjs';
import { DropDownValues } from '@app/rating-recommendation/models/interfaces/rating.interface';
import { RatingFormControlHelpers } from '@committeePackage/shared/ratings-process/helpers/rating-form-control-helpers';
import { AppRoutes } from '@app/routes/routes';
import { CancelConfirmationModalComponent } from '@app/features/cancel-confirmation-modal/cancel-confirmation-modal.component';
import { UserProfileService } from '@app/shared/services/user-profile-service';
import { UserProfile } from '@app/shared/models/UserProfile';
import { NotificationsService } from '@app/core/services/notifications.service';
import { ModalActionService } from '@app/shared/modals/services/modal-action.service';
import { RatingClassMetadata } from '@app/shared/models/RatingClassMetadata';
import { CommitteeSupportService } from '@app/shared/services/repos/committee-support.service';
import { random } from 'lodash-es';
import { RatingScaleMetadata } from '@app/shared/models/RatingScaleMetadata';
import { Domicile } from '@app/shared/models/Domicile';
import { RatingClass } from '@app/committee-package/shared/ratings-process/interfaces/rating-class';
import { defaultClassReferenceNoAction } from '@app/features/rating-recommendation/interfaces/debt.interface';
import _ from 'lodash';

@Component({
    selector: 'app-committee-table',
    templateUrl: './committee-table.component.html',
    styleUrls: ['./committee-table.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommitteeTableComponent implements OnChanges, OnDestroy {
    @ViewChild('customRatingClassTypeAhead') customRatingClassTypeAhead: BlueTypeahead;
    @Input() vote!: RatingCommitteeVote;
    @Input() finalOutlookList!: DropDownValues[];
    @Input() finalReviewStatusList!: DropDownValues[];
    @Input() finalLGDList!: DropDownValues[];
    @Input() isFinalized!: Date;
    @Input() ratingsMetadataLookup: RatingClassMetadata[];

    @Output() logVote = new EventEmitter();
    @Output() postVoteConfirmationHandler = new EventEmitter<{
        ratingCommitteeVote: RatingCommitteeVoteData;
        isCloseCommittee: boolean;
        redirectToWorklist: boolean;
        isFinalRatingsTableValid: boolean;
    }>();

    @Output() changeHandler = new EventEmitter<boolean>();
    @Output() navToBackHandler = new EventEmitter();
    @Output() navToNextHandler = new EventEmitter();

    readonly checkboxScope = BlueTableCheckboxScope.All;
    private destroy$ = new Subject<void>();
    protected disableHeaderCheckBox$!: Observable<boolean>;
    finalRatingList: string[] = [];

    ratingTableData$ = new BehaviorSubject<BlueTableData>([]);
    debtsTableData: BlueTableData = [];

    copyRecommendedDisabled = true;
    clearSelectionDisabled = true;
    entityRating: EntityRating[] = [];
    isAllRatingSelected$: Observable<boolean> = new Observable<boolean>();
    isAllRatingSelected = false;
    showModal = false;
    appRoutesEnum = AppRoutes;

    allFinalRatingsForm = this._fb.group({
        isClassView: new FormControl<boolean>(true),
        selectedVoteTally: new FormControl(),
        finalRatings: this._fb.array<FinalRating>([])
    });

    selectedRows$ = new BehaviorSubject<{ [key: string]: boolean }>({});

    voteTallyOptions = [
        {
            label: 'vote.voteTable.majority',
            value: VoteTally.MAJORITY
        },
        {
            label: 'vote.voteTable.nonMajority',
            value: VoteTally.NO_MAJORITY
        },
        {
            label: 'vote.voteTable.noVote',
            value: VoteTally.NO_VOTE
        }
    ];

    readonly majority = 'Majority';

    isVoteTallySelected = false;
    isFinalChanged$: Observable<boolean> = new Observable<boolean>();
    isFinalSelected = false;
    isMajority = false;

    permissions = [COMMITTEE_PACKAGE_STEPS.Ratings, COMMITTEE_PACKAGE_STEPS.RatingCommittee];

    initializeRoles$: Observable<Record<COMMITTEE_PACKAGE_STEPS, StepPermission[]>>;
    enumVoteTally = VoteTally;
    readonly popoverEvent = BluePopoverEvent;
    preVote$ = new Subject<boolean | null>();
    userProfile$: Observable<UserProfile> = this._userProfileService.userProfile$;
    isNotificationActive = false;

    saveContinueClicked$ = new BehaviorSubject(false);
    isFinalRatingsTableValid$: Observable<{ value: boolean }>;
    finalRatingsTableData$ = new Subject<FinalRating[]>();

    customRatingClassesState$ = new BehaviorSubject<Record<string, CustomRatingClassState>>({});
    isAnyEntitySelected$: Observable<boolean>;

    ratingClassForm: FormGroup;
    readonly _customRatingClassSubject$ = new BehaviorSubject<CustomRatingClass[]>([]);
    @Input() isFigBanking: boolean;

    constructor(
        private readonly _activatedRoute: ActivatedRoute,
        private readonly _componentPermissionService: StepPermissionService,
        private _router: Router,
        @Inject(BlueModalService) private modalService: BlueModalService,
        private _fb: FormBuilder,
        private readonly _userProfileService: UserProfileService,
        private notificationService: NotificationsService,
        private readonly _modalActionService: ModalActionService,
        private readonly committeeSupportService: CommitteeSupportService
    ) {
        this.initializeRoles$ = this._activatedRoute.params.pipe(
            switchMap(({ caseId }) => this._componentPermissionService.initializeRoles$(caseId))
        );
        this.onLoad();

        this._modalActionService.updateComponentDataEvent.pipe(takeUntil(this.destroy$)).subscribe(() => {
            this.onSave(false, true, false);
        });
        this.ratingClassForm = this._fb.group({});
    }

    ngOnInit() {
        this.isAnyEntitySelected$ = this.selectedRows$.pipe(
            map((selectedRows) => Object.values(selectedRows).some((isSelected) => isSelected))
        );
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.vote) {
            this._initializeRatingTable(changes.vote.currentValue);
        }
        this.preVote$.next(!!this.vote.preVote);
    }

    ngAfterViewInit(): void {
        this._initializeCustomRatingClassFormChanges();
    }

    private _initializeCustomRatingClassFormChanges() {
        this._customRatingClassSubject$
            .pipe(
                filter((customRatingClasses) => customRatingClasses.length > 0),
                switchMap((customRatingClasses) =>
                    merge(
                        ...customRatingClasses.map((customRatingClass) => {
                            if (!this.ratingClassForm.get(customRatingClass.identifier)) return EMPTY;
                            return combineLatest([
                                of(customRatingClass),
                                this.ratingClassForm.get(customRatingClass.identifier).valueChanges
                            ]);
                        })
                    )
                ),

                takeUntil(this.destroy$)
            )
            .subscribe(this._onRatingClassFormChanges.bind(this));
    }

    private _onRatingClassFormChanges(
        data: [{ identifier: string; domicile: { code: string; name: string } }, RatingClassMetadata]
    ) {
        const { identifier, domicile } = data[0];
        const value = data[1];
        if (value?.ratingClassName) {
            this.onRatingClassChanged(identifier, domicile, value);
        } else if (this.customRatingClassTypeAhead.inputValue === '') {
            this._setCustomRatingClassUnselected(identifier);
        }
    }

    private _setCustomRatingClassUnselected(identifier: string) {
        const data: Record<string, CustomRatingClassState> = {
            [`${identifier}`]: {
                loading: false,
                data: null
            }
        };
        this.onRatingClassChangedHelper(identifier);
        this.customRatingClassesState$.next({ ...this.customRatingClassesState$.value, ...data });
    }

    onRatingClassChanged(
        identifier: string,
        domicile: {
            code: string;
            name: string;
        },
        value: RatingClassMetadata
    ) {
        const ratingClassMetadata = value;

        const data: Record<string, CustomRatingClassState> = {};

        data[identifier] = {
            loading: true,
            data: {
                identifier,
                domicile,
                ratingClassMetadata
            }
        };
        this.customRatingClassesState$.next({ ...this.customRatingClassesState$.value, ...data });

        if (value.ratingScaleStrategy === 'LGD') {
            queueMicrotask(() => {
                this.onRatingClassChangedHelper(identifier, ratingClassMetadata, []);
                data[identifier].loading = false;
                this.customRatingClassesState$.next({ ...this.customRatingClassesState$.value, ...data });
            });
        } else
            this.committeeSupportService
                .getRatingClassesOptions(value.ratingScaleCode, value.ratingScaleStrategy, domicile?.code)
                .subscribe((ratingScaleMetadata) => {
                    this.onRatingClassChangedHelper(identifier, ratingClassMetadata, ratingScaleMetadata);
                    data[identifier].loading = false;
                    this.customRatingClassesState$.next({ ...this.customRatingClassesState$.value, ...data });
                });
    }
    onRatingClassChangedHelper(
        identfier: string,
        ratingClassMetadata?: RatingClassMetadata,
        ratingScaleMetadata?: RatingScaleMetadata[]
    ) {
        const updatedClass = this._customRatingClassSubject$.value.find(
            (customRatingClass) => customRatingClass.ratingClass.id === identfier
        );
        updatedClass.ratingClass.name = ratingClassMetadata?.ratingClassName;
        updatedClass.ratingClass.refRatingSymbols = ratingScaleMetadata
            ?.map((data) => {
                return {
                    value: data.ratingText,
                    rank: data.ratingRank,
                    group: data.group
                };
            })
            .sort((a, b) => {
                if (a.group !== b.group) {
                    return a.group - b.group;
                }
                return a.rank - b.rank;
            })
            .map((data) => data.value);

        updatedClass.ratingClass.refRatingSymbols.unshift(defaultClassReferenceNoAction.name);

        this._customRatingClassSubject$.next([
            ...this._customRatingClassSubject$.value.filter(
                (customRatingClass) => customRatingClass.ratingClass.id !== identfier
            ),
            updatedClass
        ]);

        const updatedData = [...this.ratingTableData$.value];

        updatedData.forEach((entity) => {
            if (entity.data?.entityId === updatedClass.entityId) {
                entity.children?.[0].children?.forEach((child) => {
                    if (child.data.id === updatedClass.identifier) {
                        child.data.refRatingSymbols = updatedClass.ratingClass.refRatingSymbols;
                        child.data.isLGD = ratingClassMetadata?.ratingScaleStrategy === 'LGD';
                        if (!ratingClassMetadata) {
                            const control = this.finalRatings.at(child.data.formIndex);
                            control.get('finalRating').setValue('');
                            control.get('finalReviewStatus').setValue('');
                        }
                    }
                });
            }
        });
        this.ratingTableData$.next(updatedData);
    }

    private onLoad() {
        this.listenToVoteTallyChanges();
        this.finalRatingsFormValueChanges();
        this.finalRatingsValueChanges();
        this.listenToPreVoteChanges();
        this.checkIfAllRatingsSelected();
    }

    finalRatingTableValidator$ = merge(
        this.finalRatings.valueChanges.pipe(startWith(this.finalRatings.value)),
        this.finalRatingsTableData$
    );

    private _initIsfinalRatingsTableValid() {
        this.isFinalRatingsTableValid$ = combineLatest([
            this.finalRatingTableValidator$,
            this.customRatingClassesState$
        ]).pipe(
            map(([finalRatings, customRatingClassesState]) => {
                const tableValidation = finalRatings.every((finalRatingData) => {
                    const outlookValidation = finalRatingData.isOutlook && !!finalRatingData.finalOutlook;
                    const ratingValidation = !finalRatingData.isOutlook && !!finalRatingData.finalRating;
                    const voteNotMajority =
                        finalRatingData.voted === VoteTally.NO_MAJORITY || finalRatingData.voted === VoteTally.NO_VOTE;
                    const isMajority = finalRatingData.voted === VoteTally.MAJORITY;

                    return voteNotMajority || (isMajority && (outlookValidation || ratingValidation));
                });

                const customRatingClassValidation = Object.keys(customRatingClassesState).every(
                    (id) => customRatingClassesState[id].data
                );
                return tableValidation && customRatingClassValidation;
            }),
            map((value) => ({ value }))
        );
    }

    private checkIfAllRatingsSelected() {
        this.finalRatings.valueChanges
            .pipe(
                map(
                    (data) =>
                        data.filter(
                            (el: FinalRating) =>
                                (el.isOutlook && (el.finalOutlook === '' || el.columnFinalOutlook === '')) ||
                                (!el.isOutlook && el.finalRating === '' && el.finalReviewStatus === '')
                        ).length <= 0
                ),
                tap((isAllRating: boolean) => {
                    this.isAllRatingSelected = isAllRating;
                }),
                takeUntil(this.destroy$)
            )
            .subscribe();
    }

    private listenToPreVoteChanges() {
        this.preVote$
            .pipe(
                tap((preVote) => {
                    if (preVote !== null) {
                        if (preVote === true) {
                            if (!this.prevData.hasOwnProperty('selectedVoteTally')) {
                                this.prevData.selectedVoteTally = this.allFinalRatingsForm.get('selectedVoteTally')?.value;
                            }
                            if (this.allFinalRatingsForm.get('selectedVoteTally').disabled) {
                                this.allFinalRatingsForm.get('selectedVoteTally').enable({ emitEvent: false });
                                this.disableFinalRatings(this.vote.voteTally);
                            }
                        } else {
                            this.allFinalRatingsForm.get('selectedVoteTally').disable({ emitEvent: false });
                            this.allFinalRatingsForm.get('finalRatings').disable({ emitEvent: false });
                            if (this.prevData && this.prevData.hasOwnProperty('finalRatings')) {
                                delete this.prevData.finalRatings;
                                delete this.prevData.selectedVoteTally;
                            }
                        }
                    }
                }),
                switchMap(() =>
                    merge(
                        ...this.finalRatings.controls.map((formGroup, index) =>
                            formGroup.valueChanges.pipe(
                                map(() => formGroup),
                                withLatestFrom(
                                    of(this.vote.entityRating).pipe(
                                        map(([indexEntity]) => {
                                            return (
                                                indexEntity.ratings[index] ?? {
                                                    productCode: null,
                                                    ratingTermType: null
                                                }
                                            );
                                        })
                                    )
                                ),
                                takeUntil(this.destroy$)
                            )
                        )
                    )
                ),
                tap(([formGroup]) => {
                    const { voted } = formGroup.getRawValue() as FinalRating;
                    this.updateFinalRatingsFormGroup(voted, formGroup);
                })
            )
            .subscribe();
    }

    private updateFinalRatingsFormGroup(voted: VoteTally, formGroup: AbstractControl<any, any>) {
        if (voted === VoteTally.NO_VOTE || voted === VoteTally.NO_MAJORITY) {
            this._setDefaultValue(formGroup);
            this._disableFinalRatingsFormGroup(formGroup);
        } else {
            this._enableFinalRatingsFormGroup(formGroup);
        }
    }

    private listenToVoteTallyChanges() {
        this.allFinalRatingsForm
            .get('selectedVoteTally')
            ?.valueChanges.pipe(
                tap((value) => {
                    if (value === VoteTally.MAJORITY) {
                        this.setValuesforMajority();
                        this.isMajority = true;
                    } else if (value === VoteTally.NO_VOTE) {
                        this.setValuesToNoVote();
                    } else if (value === VoteTally.NO_MAJORITY) {
                        this.setValuesforNoMajority();
                    } else {
                        this.unselectVoteValues();
                    }
                    this.isVoteTallySelected = true;
                    this.notificationService.clearNotifications();
                }),
                switchMap(() => this.notificationService.activeNotifications$),
                tap((isActive) => (this.isNotificationActive = isActive)),
                tap(() => this.finalRatingsTableData$.next(this.finalRatings.value)),
                takeUntil(this.destroy$)
            )
            .subscribe();
    }

    private finalRatingsValueChanges() {
        this.isFinalChanged$ = this.finalRatings.valueChanges.pipe(
            map(
                (data) =>
                    data.filter(
                        (el: FinalRating) =>
                            (el.isOutlook && (el.finalOutlook !== '' || el.columnFinalOutlook !== '')) ||
                            (!el.isOutlook && (el.finalRating !== '' || el.finalReviewStatus !== ''))
                    ).length > 0
            )
        );
    }

    private finalRatingsFormValueChanges() {
        this.allFinalRatingsForm?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value) => {
            if (value.finalRatings !== undefined) {
                this.checkSelection(value.finalRatings);
            }
        });
    }
    prevData: any;
    private _initializeRatingTable(currentValue) {
        this.saveContinueClicked$ = new BehaviorSubject<boolean>(false);
        this.finalRatings.clear({ emitEvent: false });
        this.vote = currentValue;
        this.entityRating = this.vote.entityRating;
        this.allFinalRatingsForm.controls['selectedVoteTally'].setValue(this.vote.voteTally, { emitEvent: false });
        this.onSelectVoteTally();

        this.mapEntityRatingToTableData();
        this.mapDebtsToTableData();

        this.isFinalSelected = this.checkFinalSelected();
        this._initHeaderCheckBoxValidityStatus();
        this._initIsfinalRatingsTableValid();
        this.prevData = _.cloneDeep(this.allFinalRatingsForm.value);
    }

    ngAfterContentInit() {
        this.allFinalRatingsForm?.valueChanges.pipe().subscribe(() => {
            this.showModal = true;
        });
    }

    private _enableFinalRatingsFormGroup(formGroup: AbstractControl): void {
        formGroup.get('isSelected')?.enable({ emitEvent: false });
        formGroup.get('isOutlook')?.enable({ emitEvent: false });
        formGroup.get('finalRating')?.enable({ emitEvent: false });
        formGroup.get('finalReviewStatus')?.enable({ emitEvent: false });
        formGroup.get('finalOutlook')?.enable({ emitEvent: false });
        formGroup.get('columnFinalOutlook')?.enable({ emitEvent: false });
        formGroup.get('voted')?.enable({ emitEvent: false });
    }

    private _disableFinalRatingsFormGroup(formGroup: AbstractControl): void {
        formGroup.get('isOutlook')?.disable({ emitEvent: false });
        formGroup.get('isSelected')?.disable({ emitEvent: false });
        formGroup.get('finalRating')?.disable({ emitEvent: false });
        formGroup.get('finalOutlook')?.disable({ emitEvent: false });
        formGroup.get('columnFinalOutlook')?.disable({ emitEvent: false });
        formGroup.get('finalReviewStatus')?.disable({ emitEvent: false });
    }

    private _setDefaultValue(formGroup: AbstractControl): void {
        formGroup.get('isSelected')?.setValue(false, { emitEvent: false });
        formGroup.get('finalRating')?.setValue('', { emitEvent: false });
        formGroup.get('finalOutlook')?.setValue('', { emitEvent: false });
        formGroup.get('columnFinalOutlook')?.setValue('', { emitEvent: false });
        formGroup.get('finalReviewStatus')?.setValue('', { emitEvent: false });
    }

    private _initHeaderCheckBoxValidityStatus(): void {
        /* CODE_DEBT We have a bug with the template where table headers is being re-rendered causing 'disableHeaderCheckBox$' to be initialized everytime on the template */
        this.disableHeaderCheckBox$ = merge(
            this.finalRatings.valueChanges,
            defer(() => of(this.finalRatings.value))
        ).pipe(
            map((data) =>
                (data as FinalRating[]).some(
                    (finalRating) =>
                        finalRating.voted === VoteTally.NO_VOTE || finalRating.voted === VoteTally.NO_MAJORITY
                )
            )
        );
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    onLogVote(): void {
        this.logVote.emit();
    }

    checkSelection(finalRatings: (FinalRating | null)[]) {
        const selectedIndex = finalRatings?.findIndex((r) => r?.isSelected === true);
        this.copyRecommendedDisabled = selectedIndex === -1;
        this.clearSelectionDisabled = selectedIndex === -1;
    }

    getCurrentRating(rating: Rating): string {
        if (rating.isOutlook) {
            return rating.currentRating;
        }

        if (rating.added) {
            return '';
        }

        let currentRating = rating.currentRating;

        if (rating.isLGD) {
            currentRating =
                this.finalLGDList.find((finalLGD) => finalLGD.value === rating.current?.value)?.name ??
                rating.current?.value ??
                '-';
        } else if (rating.current?.value === 'NO_ACTION') {
            currentRating = 'No Action';
        }

        if (rating.current?.reviewStatus) {
            const reviewStatus = this.finalReviewStatusList.find(
                (finalReviewStatus) => finalReviewStatus.value === rating.current?.reviewStatus
            )?.name;
            return `${currentRating} ${reviewStatus}`;
        }

        return currentRating;
    }

    getProposedReviewStatusLabel(rating: Rating): string {
        if (rating.added) {
            if (rating.proposedReviewStatus !== '' && rating.proposedReviewStatus !== '-') {
                return this.finalReviewStatusList.find(
                    (finalReviewStatus) => finalReviewStatus.value === rating.proposed?.reviewStatus
                )?.name;
            }
            return '';
        }

        if (rating.isOutlook) {
            return '-';
        }

        return (
            this.finalReviewStatusList.find(
                (finalReviewStatus) => finalReviewStatus.value === rating.proposed?.reviewStatus
            )?.name ?? '-'
        );
    }

    getProposedRating(rating: Rating): string {
        if (rating.added) {
            if (rating.proposedRating !== '' && rating.proposedRating !== '-') {
                return rating.proposed?.value;
            }
            return '';
        }

        if (!rating.isLGD) {
            if (rating.proposed?.value === 'NO_ACTION') {
                return 'No Action';
            }
            return rating.proposed?.value ?? '-';
        }

        return (
            this.finalLGDList.find((finalLGD) => finalLGD.value === rating.proposed?.value)?.name ??
            rating.proposed?.value ??
            '-'
        );
    }

    mapDebtsToTableData(): void {
        this.debtsTableData = this.entityRating.map((el: EntityRating) => {
            const data = (el.debts.ratingsWithoutDebts as any)
                ?.concat(
                    el.debts.ratingsWithDebts?.map((debt) => {
                        return debt.ratings.map((rating, index) => {
                            return { ...rating, ...debt, ratingCount: debt.ratings.length, index };
                        });
                    })
                )
                .flat();
            const mapRes = this._mapDebtRatingsToTableData(data);

            return {
                data: { entityName: el.entityName, entityId: el.entityId },
                children: [
                    {
                        data: { subheader: true, formIndexes: mapRes?.map((_, index) => index) },
                        isSelected: false,
                        isExpanded: true,
                        children: mapRes
                    }
                ],
                isExpanded: true,
                isSelected: false
            };
        });
    }

    private _mapDebtRatingsToTableData(data: Rating[]) {
        return data
            ?.filter((rating) => !rating.added)
            .map((rating) => {
                const currentRatingLabel = this.getCurrentRating(rating);
                const proposedRatingLabel = this.getProposedRating(rating);
                const proposedReviewStatusLabel = this.getProposedReviewStatusLabel(rating);

                return {
                    data: {
                        ...rating,
                        currentRatingLabel,
                        proposedRatingLabel,
                        proposedReviewStatusLabel
                    },
                    isSelected: false
                };
            });
    }

    setCustomRatingClassSubject(entities: EntityRating[]) {
        const addedClasses: CustomRatingClass[] = [];
        for (const entity of entities) {
            for (const rating of entity.ratings) {
                if (rating.added) {
                    addedClasses.push({
                        entityId: entity.entityId,
                        identifier: rating.id,
                        domicile: entity.domicile,
                        ratingClass: rating
                    });
                }
            }
        }

        if (addedClasses.length > 0) {
            this._customRatingClassSubject$.next(addedClasses);
        }
    }

    private _getRefRatingSymbolsForAddedRatingClasses(rating: Rating, domicile: Domicile) {
        const filteredMetadata = this.ratingsMetadataLookup.filter(
            (ratingClassMetadata) =>
                ratingClassMetadata.ratingClassName.trim().toLowerCase() === rating.name.trim().toLowerCase() ||
                ratingClassMetadata.ratingClassName.trim().toLowerCase() === rating.description.trim().toLowerCase()
        );
        this.onRatingClassChanged(rating.id, domicile, filteredMetadata[0]);
        console.log('rating class',rating.name);
    }

    private _moveAddedRatingClassesToBottom() {
        this.entityRating.forEach((entity) => {
            entity.ratings = [
                ...entity.ratings.filter((rating) => !rating.added),
                ...entity.ratings.filter((rating) => rating.added)
            ];
        });
    }

    checkRatingAddedOnRecommendedPage(rating: Rating): boolean {
        return rating.proposedRating !== '-' || (rating.added && rating.proposedRating !== '-');
    }

    mapEntityRatingToTableData(): void {
        const selectedRowsState: { [key: string]: boolean } = {};
        this._moveAddedRatingClassesToBottom();
        this.ratingTableData$.next(
            this.entityRating.map((el: EntityRating) => {
                const mapRes = el.ratings?.map((rating) => {
                    /*Side Effect To Build FinalRating Form */
                    selectedRowsState[el.entityId] = false;
                    this._buildFinalRatingForm(rating, el.entityId);
                    this.finalRatingList = rating.refRatingSymbols;
                    if (rating.added && this.checkRatingAddedOnRecommendedPage(rating)) {
                        this._getRefRatingSymbolsForAddedRatingClasses(rating, el.domicile);
                    }
                    if (!this.checkRatingAddedOnRecommendedPage(rating)) {
                        const ratingClassFormControl = this.getRatingClassFormControl(rating.id);
                        if (!ratingClassFormControl) {
                            const value = rating.description;
                            const formControl = this._fb.control({ ratingClassName: value });
                            this.ratingClassForm.addControl(rating.id, formControl);
                        }
                        this._getRefRatingSymbolsForAddedRatingClasses(rating, el.domicile);
                    }

                    const currentRatingLabel = this.getCurrentRating(rating);
                    const proposedRatingLabel = this.getProposedRating(rating);
                    const proposedReviewStatusLabel = this.getProposedReviewStatusLabel(rating);

                    return {
                        data: {
                            ...rating,
                            currentRatingLabel,
                            proposedRatingLabel,
                            proposedReviewStatusLabel,
                            formIndex: this.finalRatings.length - 1
                        },
                        isSelected: false
                    };
                });
                return {
                    data: { entityName: el.entityName, entityId: el.entityId },
                    children: [
                        {
                            data: { subheader: true, formIndexes: mapRes?.map((el) => el.data.formIndex) },
                            isSelected: false,
                            isExpanded: true,
                            children: mapRes
                        }
                    ],
                    isExpanded: true,
                    isSelected: false
                };
            })
        );
        this.selectedRows$.next(selectedRowsState);
        this.setCustomRatingClassSubject(this.entityRating);
    }

    _mapRatingToTableData(rating: Rating, entityId: string): any {
        const formGroup = this._buildFinalRatingForm(rating, entityId);

        formGroup
            .get('voted')
            .valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe((voted) => {
                this.updateFinalRatingsFormGroup(voted, formGroup);
            });

        this.finalRatingList = rating.refRatingSymbols;

        const currentRatingLabel = this.getCurrentRating(rating);
        const proposedRatingLabel = this.getProposedRating(rating);
        const proposedReviewStatusLabel = this.getProposedReviewStatusLabel(rating);

        return {
            data: {
                ...rating,
                currentRatingLabel,
                proposedRatingLabel,
                proposedReviewStatusLabel,
                formIndex: this.finalRatings.length - 1
            },
            isSelected: false
        };
    }

    onEntityTableCheckBoxSelected(
        checkBoxEvent: { checked: boolean; scope: BlueTableCheckboxScope },
        entityDetails = null
    ) {
        const currentSelectedRows = this.selectedRows$.value;
        this.selectedRows$.next({
            ...currentSelectedRows,
            [entityDetails.entityId]: checkBoxEvent.checked
        });
    }

    addRatingClass() {
        let ratingClass;
        const addedClasses: CustomRatingClass[] = [];

        this.entityRating.forEach((el: EntityRating) => {
            if (this.selectedRows$.value[el.entityId]) {
                ratingClass = {
                    added: true,
                    id: random(1, 100_000_000).toString(),
                    name: '',
                    finalRating: '',
                    finalReviewStatus: '',
                    finalOutlook: '',
                    columnFinalOutlook: '',
                    proposedRating: '-'
                } as Rating;
                el.ratings.push(ratingClass);

                const ratingClassFormControl = this.getRatingClassFormControl(ratingClass.id);
                if (!ratingClassFormControl) {
                    const value = ratingClass.name;
                    const formControl = this._fb.control({ ratingClassName: value });
                    this.ratingClassForm.addControl(ratingClass.id, formControl);
                    const newClass: CustomRatingClass = {
                        entityId: el.entityId,
                        identifier: ratingClass.id,
                        domicile: el.domicile,
                        ratingClass
                    };
                    this._customRatingClassSubject$.next([
                        ...this._customRatingClassSubject$.value,
                        { entityId: el.entityId, identifier: ratingClass.id, domicile: el.domicile, ratingClass }
                    ]);
                    addedClasses.push(newClass);
                    console.log('rating classes',newClass);
                }

                const updatedData = [...this.ratingTableData$.value];
                updatedData.forEach((entity) => {
                    if (entity.data?.entityId === el.entityId) {
                        entity.children[0].children.push(this._mapRatingToTableData(ratingClass, el.entityId));
                        entity.children[0].data.formIndexes.push(this.finalRatings.length - 1);
                    }
                });

                this.ratingTableData$.next(updatedData);
            }
        });

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
        this.finalRatingsTableData$.next(this.finalRatings.value);
    }

    getRatingClassFormControl(id: string) {
        return this.ratingClassForm.controls[id] as FormControl;
    }

    removeRatingClass(rowData: any) {
        this.entityRating.forEach((el) => {
            el.ratings = el.ratings.filter((rating) => rating.id !== rowData.id);
        });
        this.removeEntryAndAdjustFormIndexes(rowData.formIndex);
        this._customRatingClassSubject$.next(
            this._customRatingClassSubject$.value.filter(
                (customRatingClass) => customRatingClass.ratingClass.id !== rowData.id
            )
        );
        const customRatingClassesState = this.customRatingClassesState$.value;
        delete customRatingClassesState[rowData.id];
        this.customRatingClassesState$.next(customRatingClassesState);
        this.finalRatingsTableData$.next(this.finalRatings.value);
    }

    searchFn = (term: string): RatingClassMetadata[] => {
        return this.ratingsMetadataLookup.filter((ratingClassMetadata) => {
            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(`${escapedTerm}`, 'gi').test(ratingClassMetadata.ratingClassName);
        });
    };

    displayFn = (ratingClassMetadata: RatingClassMetadata) => {
        return ratingClassMetadata.ratingClassName;
    };

    removeEntryAndAdjustFormIndexes(formIndexToRemove: number): void {
        this.finalRatings.removeAt(formIndexToRemove, { emitEvent: false });

        const updatedData = this.ratingTableData$.value.map((entity) => {
            const updatedChildren = entity.children.map((child) => {
                const filteredChildren = child.children.filter(
                    (childEntry) => childEntry.data.formIndex !== formIndexToRemove
                );

                const adjustedChildren = filteredChildren.map((childEntry) => {
                    if (childEntry.data.formIndex > formIndexToRemove) {
                        childEntry.data.formIndex -= 1;
                    }
                    return childEntry;
                });

                return {
                    ...child,
                    children: adjustedChildren,
                    data: {
                        ...child.data,
                        formIndexes: adjustedChildren.map((childEntry) => childEntry.data.formIndex)
                    }
                };
            });

            return {
                ...entity,
                children: updatedChildren
            };
        });

        this.ratingTableData$.next(updatedData);
    }

    private _buildFinalRatingForm(rating: Rating, entityId: string): FormGroup {
        const finalRatingForm = this._fb.group({
            id: [rating.id],
            isSelected: this._fb.control({
                value: false,
                disabled: rating.voted === VoteTally.NO_VOTE || rating.voted === VoteTally.NO_MAJORITY
            }),
            finalRating: this._fb.control({
                value: rating.finalRating,
                disabled: rating.voted === VoteTally.NO_VOTE || rating.voted === VoteTally.NO_MAJORITY
            }),
            finalReviewStatus: this._fb.control({
                value: rating.finalReviewStatus,
                disabled: rating.voted === VoteTally.NO_VOTE || rating.voted === VoteTally.NO_MAJORITY
            }),
            finalOutlook: this._fb.control({
                value: rating.finalOutlook,
                disabled: rating.voted === VoteTally.NO_VOTE || rating.voted === VoteTally.NO_MAJORITY
            }),
            columnFinalOutlook: this._fb.control({
                value: rating.finalOutlook,
                disabled: rating.voted === VoteTally.NO_VOTE || rating.voted === VoteTally.NO_MAJORITY
            }),
            entityId: [entityId],
            voted: [rating.voted],
            isOutlook: [rating.isOutlook]
        });

        this.finalRatings.push(finalRatingForm, { emitEvent: false });
        return finalRatingForm;
    }

    get finalRatings(): FormArray {
        return this.allFinalRatingsForm.controls['finalRatings'] as FormArray;
    }

    onSelectOutlook(finalRatingDetails: Rating, index: number) {
        const { productCode, ratingTermType: term } = finalRatingDetails;
        RatingFormControlHelpers.DisableControl(
            { productCode, term },
            this.finalRatings.at(index),
            'finalReviewStatus',
            'finalOutlook'
        );

        RatingFormControlHelpers.SetControlDefaultValue(
            { productCode, term },
            this.finalRatings.at(index),
            'finalRating',
            'finalReviewStatus'
        );
    }

    onChangeRatingValue(finalRatingDetails: Rating, index: number) {
        const { productCode, ratingTermType: term } = finalRatingDetails;
        const ratingFormGroup = this.finalRatings.at(index);

        if (ratingFormGroup.value.finalOutlook) {
            RatingFormControlHelpers.ResetControlValue(
                { productCode, term },
                ratingFormGroup,
                'finalRating',
                'finalOutlook'
            );

            RatingFormControlHelpers.DisableControl(
                { productCode, term },
                ratingFormGroup,
                'finalReviewStatus',
                'finalOutlook'
            );
        } else if (
            !ratingFormGroup.get('finalReviewStatus')?.disabled &&
            ratingFormGroup.get('finalOutlook')?.disabled
        ) {
            RatingFormControlHelpers.SetControlDefaultValue(
                { productCode, term },
                ratingFormGroup,
                'finalRating',
                'finalReviewStatus'
            );
        }
    }

    /* CODE_DEBT cleanup function proposed rating is adding a value (--) that does not exist on the ratings dropdowns*/
    copyRecommended(): void {
        this.copyRecommendedDisabled = true;
        const formIndexMap = this._createFormIndexMap();
        this.ratingTableData$.next(
            this.entityRating.map((el: EntityRating) => {
                const mapRes = el.ratings.map((rating) =>
                    this._buildTableDataFromProposedRatingValues(rating, formIndexMap)
                );
                return {
                    data: { entityName: el.entityName, entityId: el.entityId },
                    children: [
                        {
                            data: { subheader: true, formIndexes: mapRes.map((el) => el.data.formIndex) },
                            isSelected: false,
                            isExpanded: true,
                            children: mapRes
                        }
                    ],
                    isExpanded: true,
                    isSelected: false
                };
            })
        );
    }

    private _buildTableDataFromProposedRatingValues(rating: Rating, formIndexMap: Record<string, number>) {
        const currentRatingLabel = this.getCurrentRating(rating);
        const proposedRatingLabel = this.getProposedRating(rating);

        const proposedReviewStatusLabel = this.getProposedReviewStatusLabel(rating);

        const formControl = this.getFormControlById(rating.id);

        if (formControl.get('isSelected')?.value) {
            formControl.get('voted')?.enable({ emitEvent: false });
            formControl.get('finalRating')?.setValue(rating.proposed?.value ?? '');
            formControl.get('finalOutlook')?.setValue(rating.proposed?.value ?? '');
            formControl.get('columnFinalOutlook')?.setValue(rating.proposed?.outlook ?? '');
            formControl.get('finalReviewStatus')?.setValue(rating.proposed?.reviewStatus ?? '');
        }
        formControl.get('isSelected')?.setValue(false);

        return {
            data: {
                ...rating,
                currentRatingLabel,
                proposedRatingLabel,
                proposedReviewStatusLabel,
                formIndex: formIndexMap[rating.id] ?? 0
            },
            isSelected: false
        };
    }

    private _createFormIndexMap() {
        const data = this.ratingTableData$.value;
        return data
            .filter((row) => !!row.children?.length)
            .flatMap((row) => row.children)
            .filter((row) => !!row.children?.length)
            .flatMap((row) => row.children)
            .reduce((acc, row) => {
                const index: number = row.data?.formIndex;
                if (index !== undefined) {
                    const id: string = row.data.id;
                    acc[id] = index;
                }
                return acc;
            }, {} as Record<string, number>);
    }

    onRatingChecked(checkedEvent: { checked: boolean }, indexes: number | number[]): void {
        if (typeof indexes === 'number') {
            this.setSelectedForIndex(indexes, checkedEvent?.checked);
        } else {
            this.selectUnselectAll(checkedEvent?.checked, indexes);
        }
    }

    selectUnselectAll(isChecked: boolean, indexes: number[]): void {
        const formIndexMap = this._createFormIndexMap();

        this.ratingTableData$.next(
            this.entityRating.map((el: EntityRating) => {
                const mapRes = el.ratings
                    .map((rating) => {
                        const currentRatingLabel = this.getCurrentRating(rating);
                        const proposedRatingLabel = this.getProposedRating(rating);
                        const proposedReviewStatusLabel = this.getProposedReviewStatusLabel(rating);
                        const formControl = this.getFormControlById(rating.id);
                        const wasChecked = formControl.get('isSelected').value;
                        const currentIndex = formIndexMap[rating.id];
                        let isSelected = isChecked
                            ? indexes.includes(currentIndex) || wasChecked
                            : wasChecked && !indexes.includes(currentIndex);
                        formControl.patchValue({ isSelected });
                        return {
                            data: {
                                ...rating,
                                currentRatingLabel,
                                proposedRatingLabel,
                                proposedReviewStatusLabel,
                                formIndex: formIndexMap[rating.id] ?? 0
                            },
                            isSelected
                        };
                });
                return {
                    data: { entityName: el.entityName, entityId: el.entityId },
                    children: [
                        {
                            data: { subheader: true, formIndexes: mapRes.map((el) => el.data.formIndex) },
                            isSelected: mapRes.some(item => item.isSelected),
                            isExpanded: true,
                            children: mapRes
                        }
                    ],
                    isExpanded: true,
                    isSelected: false
                };
            })
        );
    }

    setSelectedForIndex(index: number, checked: boolean) {
        this.finalRatings.controls.at(index)?.get('isSelected')?.setValue(checked);
    }
    getFormControlById(id: string) {
        return this.finalRatings.controls.filter((r) => r.get('id')?.value == id)[0];
    }

    clearSelection(): void {
        this.clearSelectionDisabled = true;
        const formIndexMap = this._createFormIndexMap();
        this.ratingTableData$.next(
            this.entityRating.map((el: EntityRating) => {
                const mapRes = el.ratings.map((rating) => {
                    const currentRatingLabel = this.getCurrentRating(rating);
                    const proposedRatingLabel = this.getProposedRating(rating);
                    const proposedReviewStatusLabel = this.getProposedReviewStatusLabel(rating);
                    const formControl = this.getFormControlById(rating.id);
                    if (formControl.get('isSelected')?.value) {
                        formControl.get('finalRating')?.setValue('');
                        formControl.get('finalOutlook')?.setValue('');
                        formControl.get('columnFinalOutlook').setValue('');
                        formControl.get('finalReviewStatus')?.setValue('');
                    }
                    formControl.get('isSelected')?.setValue(false);
                    return {
                        data: {
                            ...rating,
                            currentRatingLabel,
                            proposedRatingLabel,
                            proposedReviewStatusLabel,
                            formIndex: formIndexMap[rating.id] ?? 0
                        },
                        isSelected: false
                    };
                });
                return {
                    data: { entityName: el.entityName, entityId: el.entityId },
                    children: [
                        {
                            data: { subheader: true, formIndexes: mapRes.map((el) => el.data.formIndex) },
                            isSelected: false,
                            isExpanded: true,
                            children: mapRes
                        }
                    ],
                    isExpanded: true,
                    isSelected: false
                };
            })
        );
    }

    transform(): RatingCommitteeVoteData {
        const finalRatings = this.finalRatings.getRawValue();
        const finalEntityRatings = this.entityRating.map((el: EntityRating) => {
            return {
                owningEntityName: el.entityName,
                owningEntityId: el.entityId,
                ratings: finalRatings
                    .filter((item: FinalRating) => item.entityId === el.entityId)
                    .map((item: FinalRating) => {
                        const rating = el.ratings.find((rating) => rating.id === item.id);
                        if (rating?.isOutlook) {
                            return {
                                key: rating.id,
                                current: rating.current,
                                proposed: rating.proposed,
                                finalized: {
                                    voted: item.voted,
                                    outlook: this.finalOutlookList.find((status) => item.finalOutlook === status.value)
                                        ? item.finalOutlook
                                        : undefined
                                },
                                bridge: rating.bridge
                            };
                        }
                        return {
                            ratingClass: rating?.ratingClass ?? this._getRatingClassFromDescription(rating?.name),
                            key: this._getKeyForSaveRatingClass(rating, el),
                            current: rating?.current,
                            proposed: rating?.proposed,
                            finalized: {
                                voted: item.voted,
                                value: item.finalRating,
                                outlook: item.columnFinalOutlook,

                                reviewStatus: this.finalReviewStatusList.find(
                                    (status) => item.finalReviewStatus === status.value
                                )
                                    ? item.finalReviewStatus
                                    : undefined
                            },
                            bridge: rating?.bridge,
                            added: rating?.added
                        };
                    }),
                debts: el.debtsMetaData
            };
        });

        return {
            voteTally: this.allFinalRatingsForm.get('selectedVoteTally')?.value,
            entityRating: finalEntityRatings
        } as RatingCommitteeVoteData;
    }
    private _getRatingClassFromDescription(description: string): RatingClass {
        const arr = description.split(' (');

        const name = arr[0];

        const currency = arr[1] ? arr[1].slice(0, -1).toUpperCase() : 'DOMESTIC';

        return {
            name,
            currency,
            description,
            publicIndicator: true
        } as RatingClass;
    }

    private _getKeyForSaveRatingClass(rating: Rating, entity: EntityRating): string {
        if (!rating.added || rating.id.split('_').length > 1) return rating.id;

        const startIndex = rating.name.indexOf('(');
        const endIndex = rating.name.indexOf(')', startIndex);

        const currency =
            startIndex !== -1 && endIndex !== -1 ? rating.name.substring(startIndex + 1, endIndex).trim() : '';

        const nameWithoutParentheses =
            startIndex !== -1 ? rating.name.substring(0, startIndex).trim() : rating.name.trim();

        const transformedName = nameWithoutParentheses.replace(/[^\w\s]/g, '').replace(/\s+/g, '_');

        const result = [entity.entityId, transformedName, rating.id, currency].filter(Boolean).join('_');

        return result;
    }

    onSave(isCloseCommittee: boolean, redirectToWorklist: boolean, isFinalRatingsTableValid: boolean): void {
        this.showModal = false;
        if (isCloseCommittee) {
            this.saveContinueClicked$.next(true);
        }
        const ratingCommitteeVote = this.transform();
        this.postVoteConfirmationHandler.emit({
            ratingCommitteeVote,
            isCloseCommittee,
            redirectToWorklist,
            isFinalRatingsTableValid
        });
    }

    checkFinalSelected(): boolean {
        return this.finalRatings.value.every(
            (el: FinalRating) => (el.finalRating && el.finalOutlook && el.finalReviewStatus) !== ''
        );
    }

    onSelectVoteTally() {
        this.isVoteTallySelected = this.allFinalRatingsForm.get('selectedVoteTally')?.value !== null;
        this.notificationService.clearNotifications();
    }

    setValuesforMajority(): void {
        this.copyRecommendedDisabled = true;
        const formIndexMap = this._createFormIndexMap();
        this.ratingTableData$.next(
            this.entityRating.map((el: EntityRating) => {
                const mapRes = el.ratings.map((rating) => {
                    const currentRatingLabel = this.getCurrentRating(rating);
                    const proposedRatingLabel = this.getProposedRating(rating);
                    const proposedReviewStatusLabel = this.getProposedReviewStatusLabel(rating);

                    const formControl = this.getFormControlById(rating.id);

                    formControl.get('voted')?.enable({ emitEvent: false });
                    formControl.get('voted')?.setValue(VoteTally.MAJORITY);
                    formControl.get('isSelected')?.setValue(false);

                    return {
                        data: {
                            ...rating,
                            currentRatingLabel,
                            proposedRatingLabel,
                            proposedReviewStatusLabel,
                            formIndex: formIndexMap[rating.id] ?? 0
                        },
                        isSelected: false
                    };
                });
                return {
                    data: { entityName: el.entityName, entityId: el.entityId },
                    children: [
                        {
                            data: { subheader: true, formIndexes: mapRes.map((el) => el.data.formIndex) },
                            isSelected: false,
                            isExpanded: true,
                            children: mapRes
                        }
                    ],
                    isExpanded: true,
                    isSelected: false
                };
            })
        );
    }

    setValuesToNoVote(): void {
        const formIndexMap = this._createFormIndexMap();
        this.ratingTableData$.next(
            this.entityRating.map((el: EntityRating) => {
                const mapRes = el.ratings.map((rating) => {
                    const currentRatingLabel = this.getCurrentRating(rating);
                    const proposedRatingLabel = this.getProposedRating(rating);
                    const proposedReviewStatusLabel = this.getProposedReviewStatusLabel(rating);

                    const formControl = this.getFormControlById(rating.id);
                    formControl.patchValue(
                        {
                            voted: VoteTally.NO_VOTE,
                            isSelected: false,
                            finalRating: '',
                            finalReviewStatus: '',
                            finalOutlook: '',
                            columnFinalOutlookList: '',
                            columnFinalOutlook: ''
                        },
                        { emitEvent: false }
                    );
                    formControl.disable({ emitEvent: false });
                    formControl.get('voted')?.enable({ emitEvent: false });
                    return {
                        data: {
                            ...rating,
                            currentRatingLabel,
                            proposedRatingLabel,
                            proposedReviewStatusLabel,
                            formIndex: formIndexMap[rating.id] ?? 0
                        },
                        isSelected: false
                    };
                });
                return {
                    data: { entityName: el.entityName, entityId: el.entityId },
                    children: [
                        {
                            data: { subheader: true, formIndexes: mapRes.map((el) => el.data.formIndex) },
                            isSelected: false,
                            isExpanded: true,
                            children: mapRes
                        }
                    ],
                    isExpanded: true,
                    isSelected: false
                };
            })
        );
    }

    setValuesforNoMajority(): void {
        const formIndexMap = this._createFormIndexMap();
        this.ratingTableData$.next(
            this.entityRating.map((el: EntityRating) => {
                const mapRes = el.ratings.map((rating) => {
                    const currentRatingLabel = this.getCurrentRating(rating);
                    const proposedRatingLabel = this.getProposedRating(rating);
                    const proposedReviewStatusLabel = this.getProposedReviewStatusLabel(rating);
                    const formControl = this.getFormControlById(rating.id);
                    formControl.patchValue(
                        {
                            voted: VoteTally.NO_MAJORITY,
                            isSelected: false,
                            finalRating: '',
                            finalReviewStatus: '',
                            finalOutlook: '',
                            columnFinalOutlookList: ''
                        },
                        { emitEvent: false }
                    );
                    formControl.disable({ emitEvent: false });
                    formControl.get('voted')?.enable({ emitEvent: false });
                    return {
                        data: {
                            ...rating,
                            currentRatingLabel,
                            proposedRatingLabel,
                            proposedReviewStatusLabel,
                            formIndex: formIndexMap[rating.id] ?? 0
                        },
                        isSelected: false
                    };
                });
                return {
                    data: { entityName: el.entityName, entityId: el.entityId },
                    children: [
                        {
                            data: { subheader: true, formIndexes: mapRes.map((el) => el.data.formIndex) },
                            isSelected: false,
                            isExpanded: true,
                            children: mapRes
                        }
                    ],
                    isExpanded: true,
                    isSelected: false
                };
            })
        );
    }

    unselectVoteValues(): void {
        this.entityRating.forEach((el: EntityRating) => {
            el.ratings.forEach((rating) => {
                const formControl = this.getFormControlById(rating.id);
                formControl.patchValue({ voted: 'null' }, { emitEvent: false });
            });
        });
    }

    public get hasUnsavedChanges() {
        return !_.isEqual(this.prevData, this.allFinalRatingsForm.value);
    }

    navigateTo(path: string): void {
        if (this.showModal || this.hasUnsavedChanges) {
            const modalRef = this.modalService.open(CancelConfirmationModalComponent, {
                showGeneralMessage: true,
                acceptFn: () => {
                    this.prevData = _.cloneDeep(this.allFinalRatingsForm.value);
                    this._router.navigate([path]);
                },
                dismissFn: () => {
                    modalRef.close();
                }
            });
        } else {
            this._router.navigate([path]);
        }
    }

    get isCommitteeClosedDisabled(): boolean {
        return (
            this.allFinalRatingsForm.get('selectedVoteTally')?.value !== VoteTally.NO_VOTE &&
            this.allFinalRatingsForm.get('selectedVoteTally')?.value !== VoteTally.NO_MAJORITY &&
            (this.finalRatings.invalid ||
                (!this.isAllRatingSelected && !this.isFinalSelected) ||
                !this.isVoteTallySelected ||
                !this.vote.preVote ||
                !!this.vote.postCommittee)
        );
    }

    disableFinalRatings(voteTally: string): void {
        if (voteTally !== VoteTally.NO_VOTE && voteTally !== VoteTally.NO_MAJORITY) {
            this.allFinalRatingsForm.get('finalRatings').enable({ emitEvent: false });
        } else {
            this.allFinalRatingsForm.get('finalRatings').disable({ emitEvent: true });
            if (this.prevData && this.prevData.hasOwnProperty('finalRatings')) {
                delete this.prevData.finalRatings;
            }
        }
    }
}

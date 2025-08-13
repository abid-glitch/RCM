import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output
} from '@angular/core';
import {
    CustomDebt,
    CustomRatingClass,
    RatingRecommendationUpdatedAction,
    RecommendationDropDownOption,
    SelectedRatingRecommendationEntities,
    SelectionDetails
} from '../../interfaces';
import { RatingRecommendationTableView } from '../../enums/rating-recommendation.enum';
import { BehaviorSubject, combineLatest, merge, of, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap, takeUntil, tap } from 'rxjs/operators';
import { RecommendationInputTypes } from '../../enums';
import { BluePopoverEvent, BlueTableCheckboxScope, BlueTableData, BlueTableRowData } from '@moodys/blue-ng';
import { BlueInputConst } from '@moodys/blue-ng/lib/util';
import { BlueIconName } from '@moodys/blue-ng/tmp/icons/ts/blue-icon-name';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { getRatingClassIdentifier } from '@features/rating-recommendation';
import { RatingClassMetadata } from '@app/shared/models/RatingClassMetadata';
import {
    CustomRatingClassData,
    CustomRatingClassDataComicile,
    CustomRatingClassState
} from '../../models/custom-rating-class-state';
import { CustomDebtData, CustomDebtState } from '../../models/custom-debt-state';
import { LocalizedDatePipe } from '@app/shared/pipes/localized-date.pipe';

@Component({
    selector: 'app-recommendation-table',
    templateUrl: './recommendation-table.component.html',
    styleUrls: ['./recommendation-table.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecommendationTableComponent implements OnInit, OnDestroy, AfterViewInit {
    /*Table Header Colspan Defaults */
    readonly defaultColSpanEntityNameOrIDClassView = 4;
    readonly defaultColSpanEntityNameOrIDDebtView = 2;

    readonly defaultColSpanCurrentClassView = 5;
    readonly defaultColSpanCurrentDebtView = 6;

    readonly defaultColSpanViewFig = 5;

    @Input() ratingRecommendation!: BlueTableData;
    @Input() selectedTableView!: RatingRecommendationTableView;
    @Input() recommendationsDropdownOptionMapping!: RecommendationDropDownOption;
    @Input() isFigBanking!: boolean;
    @Input() continueClicked = false;
    @Input() customRatingClassesState: Record<string, CustomRatingClassState>;
    private _customRatingClasses: CustomRatingClass[] = [];
    @Input()
    set customRatingClasses(value: CustomRatingClass[]) {
        this._customRatingClasses = value;
        this._onRatingClassChanged();
    }
    @Input() ratingsMetadataLookup: RatingClassMetadata[];
    @Input() isCommitteeWorkflow = false;

    @Input() customDebtsState: Record<string, CustomDebtState>;
    private _customDebts: CustomDebt[] = [];
    @Input()
    set customDebts(value: CustomDebt[]) {
        this._customDebts = value;
        this._onDebtsChanged();
    }

    readonly tableViewType = RatingRecommendationTableView;
    readonly checkboxScope = BlueTableCheckboxScope;
    readonly inputTypes = RecommendationInputTypes;
    readonly reviewStatus = RecommendationInputTypes.REVIEW_STATUS;

    readonly popoverEvent = BluePopoverEvent;
    readonly removeIcon: BlueInputConst<typeof BlueIconName> = 'trash';

    selectedEntity = new Map<RatingRecommendationTableView, BlueTableData>();
    @Output() selectedEntityChanged = new EventEmitter<SelectedRatingRecommendationEntities>();

    @Output() recommendationChange = new EventEmitter<RatingRecommendationUpdatedAction<Record<string, any>>>();
    @Output() updatedRatingRecommendation = new EventEmitter<BlueTableData>();
    @Output() ratingClassRemoved = new EventEmitter<string>();
    @Output() ratingClassChanged = new EventEmitter<CustomRatingClassData>();

    @Output() debtRemoved = new EventEmitter<string>();
    @Output() debtChanged = new EventEmitter<CustomDebtData>();

    manageCheckboxSelected = new BehaviorSubject<SelectedRatingRecommendationEntities | null>(null);
    unSubscribe = new Subject<void>();

    /*To Ensure Sync Happens In Debt View*/
    private initializeSelectedDebtView = false;

    ratingClassForm: FormGroup;
    debtForm: FormGroup;

    private customRatingClasses$ = new BehaviorSubject<
        { identifier: string; domicile: { code: string; name: string } }[]
    >([]);

    private customDebts$ = new BehaviorSubject<
        { entityId: string; identifier: string; domicile: { code: string; name: string } }[]
    >([]);

    readonly minMaturityDate: Date = new Date(new Date().setHours(0, 0, 0, 0));

    constructor(private readonly _formBuilder: FormBuilder, private readonly datePipe: LocalizedDatePipe) {
        this.ratingClassForm = this._formBuilder.group({});
        this._initializeCustomRatingClassFormChanges();

        // Each debt will have its own form gorup, key/value pair
        // Example - 123 : {ratingClass:'', description:'', currency} => FormGroup
        this.debtForm = this._formBuilder.group({});

        this._initializeCustomDebtFormChanges();
    }

    ngOnInit(): void {
        this.initCheckboxActionObservable();
    }

    ngAfterViewInit(): void {
        this.initializeSelected();
        this.initializeSelectedDebtView = true;
    }

    // change to updateRecommendation
    updateRecommendationEventEmitter(
        event: RatingRecommendationUpdatedAction<Record<string, any>>,
        row: BlueTableRowData
    ) {
        row.data = { ...event.rating };
        this.recommendationChange.emit(event);
        this.updatedRatingRecommendation.emit(this.ratingRecommendation);
    }

    onEntityTableSelect(selectedEntity: BlueTableData) {
        this.selectedEntity.set(this.selectedTableView, selectedEntity);
        this.manageInitialDebtViewSync();
    }

    // onEntityTableCheckBoxSelected(
    //     checkBoxEvent: { checked: boolean; scope: BlueTableCheckboxScope },
    //     entityDetails = null
    // ) {
    //     this.manageCheckboxSelected.next({
    //         [this.selectedTableView]: {
    //             blueTableData: this.selectedEntity.get(this.selectedTableView),
    //             checkBoxEvent: checkBoxEvent,
    //             entityDetails: entityDetails
    //         } as SelectionDetails
    //     });
    // }

    // Update the existing method
onEntityTableCheckBoxSelected(
    checkBoxEvent: { checked: boolean; scope: BlueTableCheckboxScope },
    entityDetails = null
) {
    // Handle child checkbox changes
    if (checkBoxEvent.scope === BlueTableCheckboxScope.Row && entityDetails) {
        // Update the specific row's checked state
        const childRows = this.ratingRecommendation?.[0]?.children || [];
        const targetRow = childRows.find(row => row.data.identifier === entityDetails.identifier);
        if (targetRow) {
            (targetRow as any).checked = checkBoxEvent.checked;
        }
        
        // Update parent checkbox state based on children
        this.updateParentCheckboxState();
    }
    
    // Handle parent checkbox changes (Entity Name/ID)
    if (checkBoxEvent.scope === BlueTableCheckboxScope.All) {
        const childRows = this.ratingRecommendation?.[0]?.children || [];
        // Update all children to match parent state
        childRows.forEach(row => {
            (row as any).checked = checkBoxEvent.checked;
        });
        
        // Update parent state
        const parentRow = this.ratingRecommendation?.[0];
        if (parentRow) {
            (parentRow as any).checked = checkBoxEvent.checked;
            (parentRow as any).indeterminate = false;
        }
    }

    this.manageCheckboxSelected.next({
        [this.selectedTableView]: {
            blueTableData: this.selectedEntity.get(this.selectedTableView),
            checkBoxEvent: checkBoxEvent,
            entityDetails: entityDetails
        } as SelectionDetails
    });
}

    // Add this method to handle parent-child checkbox synchronization
private updateParentCheckboxState(): void {
    // Get all child checkboxes in the current table view
    const childRows = this.ratingRecommendation?.[0]?.children || [];
    const checkedChildren = childRows.filter(row => (row as any).checked === true);
    const parentRow = this.ratingRecommendation?.[0];
    
    if (parentRow) {
        if (checkedChildren.length === 0) {
            // No children checked - uncheck parent
            (parentRow as any).checked = false;
            (parentRow as any).indeterminate = false;
        } else if (checkedChildren.length === childRows.length) {
            // All children checked - check parent
            (parentRow as any).checked = true;
            (parentRow as any).indeterminate = false;
        } else {
            // Some children checked - set parent to indeterminate
            (parentRow as any).checked = false;
            (parentRow as any).indeterminate = true;
        }
    }
}




    private initCheckboxActionObservable(): void {
        this.manageCheckboxSelected
            .pipe(
                debounceTime(200),
                tap((checkboxSelected) => this.emitSelectedEntities(checkboxSelected)),
                takeUntil(this.unSubscribe)
            )
            .subscribe();
    }

    // private emitSelectedEntities(checkboxSelected: SelectedRatingRecommendationEntities) {
    //     if (checkboxSelected) {
    //         const selectedEntities: SelectedRatingRecommendationEntities = {
    //             [this.selectedTableView]: {
    //                 ...checkboxSelected[this.selectedTableView],
    //                 blueTableData: this.selectedEntity.get(this.selectedTableView)
    //             }
    //         };

    //         this.selectedEntityChanged.emit({
    //             ...selectedEntities
    //         });
    //     }
    // }

    // Also update the emitSelectedEntities method to handle the state properly
private emitSelectedEntities(checkboxSelected: SelectedRatingRecommendationEntities) {
    if (checkboxSelected) {
        // Update the table data to reflect current checkbox states
        this.updatedRatingRecommendation.emit(this.ratingRecommendation);
        
        const selectedEntities: SelectedRatingRecommendationEntities = {
            [this.selectedTableView]: {
                ...checkboxSelected[this.selectedTableView],
                blueTableData: this.selectedEntity.get(this.selectedTableView)
            }
        };

        this.selectedEntityChanged.emit({
            ...selectedEntities
        });
    }
}

    private initializeSelected() {
        if (this.selectedEntity.has(this.selectedTableView)) {
            const selectionDetails: SelectionDetails = {
                checkBoxEvent: null,
                entityDetails: null,
                blueTableData: this.selectedEntity.get(this.selectedTableView)
            };
            const initValueSelected: SelectedRatingRecommendationEntities = {
                [this.selectedTableView]: selectionDetails
            };
            this.manageCheckboxSelected.next(initValueSelected);
        }
    }

    private manageInitialDebtViewSync() {
        if (this.initializeSelectedDebtView && this.selectedTableView === RatingRecommendationTableView.Debt) {
            this.initializeSelected();
            this.initializeSelectedDebtView = false;
        }
    }

    onRatingClassRemoved(identifier: string) {
        this.ratingClassRemoved.emit(identifier);
    }

    onDebtRemoved(identifier: string) {
        this.debtRemoved.emit(identifier);
    }

    private _onDebtsChanged() {
        this._customDebts.forEach(this._setCustomDebt.bind(this));
    }

    private _setCustomDebt(customDebt: CustomDebt) {
        const identifier = customDebt.debt.ratings[0].identifier.toString();
        const domicile = customDebt.domicile;
        const debtFormGroup = this.getDebtFormGroup(identifier);
        const currencyCode = customDebt.debt.currencyCode || '';
        const maturityDate = customDebt.debt.maturityDate || '';
        const originalFaceAmount = customDebt.debt.originalFaceAmount || '';
        const name = customDebt.debt.name || '';
        if (!debtFormGroup) {
            const value = customDebt.debt.ratings[0].name;
            const formGorup = this._formBuilder.group({
                ratingClass: {},
                name: name,
                originalFaceAmount: originalFaceAmount,
                currencyCode: currencyCode,
                maturityDate: maturityDate ? new Date(maturityDate) : null
            });
            this.debtForm.addControl(identifier, formGorup);

            this.customDebts$.next([...this.customDebts$.value, { ...customDebt, identifier, domicile }]);

            if (value !== '') {
                const lookup = this.ratingsMetadataLookup.find((metadata) => metadata.ratingClassName === value);
                if (lookup) {
                    formGorup.get('ratingClass').setValue(lookup);
                }
            }
        }
    }

    private _onRatingClassChanged() {
        this._customRatingClasses.forEach(this._setCustomRatingClass.bind(this));
    }

    private _setCustomRatingClass(customRatingClass: CustomRatingClass) {
        const identifier = getRatingClassIdentifier(customRatingClass.ratingClass);
        const domicile = customRatingClass.domicile;
        const ratingClassFormControl = this.getRatingClassFormControl(identifier);
        if (!ratingClassFormControl) {
            const value = customRatingClass.ratingClass.name;
            const formControl = this._formBuilder.control({ ratingClassName: value });
            this.ratingClassForm.addControl(identifier, formControl);
            this.customRatingClasses$.next([...this.customRatingClasses$.value, { identifier, domicile }]);

            if (value !== '') {
                const lookup = this.ratingsMetadataLookup.find((metadata) => metadata.ratingClassName === value);
                if (lookup) {
                    formControl.setValue(lookup);
                }
            }
        }
    }

    getRatingClassFormControl(identifier: string) {
        return this.ratingClassForm.controls[identifier] as FormControl;
    }

    getDebtFormGroup(identifier: string) {
        return this.debtForm.get(identifier) as FormGroup;
    }

    private _initializeCustomRatingClassFormChanges() {
        this.customRatingClasses$
            .pipe(
                filter((customRatingClasses) => customRatingClasses.length > 0),
                switchMap((customRatingClasses) =>
                    merge(
                        ...customRatingClasses.map((customRatingClass) =>
                            combineLatest([
                                of(customRatingClass),
                                this.ratingClassForm.get(customRatingClass.identifier).valueChanges
                            ])
                        )
                    )
                ),
                takeUntil(this.unSubscribe)
            )
            .subscribe(this._onRatingClassFormChanges.bind(this));
    }

    private _onRatingClassFormChanges(
        data: [{ identifier: string; domicile: CustomRatingClassDataComicile }, RatingClassMetadata]
    ) {
        const { identifier, domicile } = data[0];
        const value = data[1];
        this.ratingClassChanged.emit({ identifier, domicile, ratingClassMetadata: value });
    }

    private _initializeCustomDebtFormChanges() {
        this.customDebts$
            .pipe(
                filter((customDebts) => customDebts.length > 0),
                switchMap((customDebts) =>
                    merge(
                        ...customDebts.map((customDebt) => {
                            return combineLatest([
                                of(customDebt),
                                this.debtForm.get(customDebt.identifier).valueChanges.pipe(distinctUntilChanged())
                            ]);
                        })
                    )
                ),
                takeUntil(this.unSubscribe)
            )
            .subscribe(this._onDebtFormChanges.bind(this));
    }

    private _onDebtFormChanges(
        data: [
            { identifier: string; domicile: CustomRatingClassDataComicile; entityId: string },
            {
                name: string;
                originalFaceAmount: string;
                currencyCode: string;
                maturityDate: string;
                ratingClass: RatingClassMetadata;
            }
        ]
    ) {
        const { identifier, domicile, entityId } = data[0];
        const { name, originalFaceAmount, currencyCode, ratingClass } = data[1];

        let maturityDate = data[1].maturityDate;

        if (maturityDate) {
            maturityDate = this.datePipe.transform(new Date(maturityDate).toISOString(), 'YYYY-MM-dd');
        }

        this.debtChanged.emit({
            entityId,
            identifier,
            domicile,
            name,
            originalFaceAmount,
            currencyCode,
            maturityDate,
            ratingClassMetadata: ratingClass
        });
    }

    ngOnDestroy(): void {
        this.unSubscribe.next();
        this.unSubscribe.complete();
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

    checkNextForSplitRating(currentIndex: number, currentItem: any): boolean {
        const property = 'name';
        const currencyProperty = 'currency';
        if (currentIndex === 0 || currentIndex === 1) return false;
        if (currentIndex < this.ratingRecommendation[0].children.length - 1) {
            const previousItem = this.ratingRecommendation[0].children[currentIndex + 1];
            return (
                previousItem?.data?.[property] === currentItem?.data?.[property] &&
                previousItem?.data?.[currencyProperty] === currentItem?.data?.[currencyProperty]
            );
        }
        return false;
    }
}

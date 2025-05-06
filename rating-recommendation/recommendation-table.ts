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
    CustomRatingClass,
    RatingRecommendationUpdatedAction,
    RecommendationDropDownOption,
    SelectedRatingRecommendationEntities,
    SelectionDetails
} from '../../interfaces';
import { RatingRecommendationTableView } from '../../enums/rating-recommendation.enum';
import { BehaviorSubject, combineLatest, merge, of, Subject } from 'rxjs';
import { debounceTime, filter, switchMap, takeUntil, tap } from 'rxjs/operators';
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
    readonly defaultColSpanCurrentDebtView = 5;

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

    manageCheckboxSelected = new BehaviorSubject<SelectedRatingRecommendationEntities | null>(null);
    unSubscribe = new Subject<void>();

    /*To Ensure Sync Happens In Debt View*/
    private initializeSelectedDebtView = false;

    ratingClassForm: FormGroup;

    private customRatingClasses$ = new BehaviorSubject<
        { identifier: string; domicile: { code: string; name: string } }[]
    >([]);

    constructor(private readonly _formBuilder: FormBuilder) {
        this.ratingClassForm = this._formBuilder.group({});
        this._initializeCustomRatingClassFormChanges();
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

    onEntityTableCheckBoxSelected(
        checkBoxEvent: { checked: boolean; scope: BlueTableCheckboxScope },
        entityDetails = null
    ) {
        this.manageCheckboxSelected.next({
            [this.selectedTableView]: {
                blueTableData: this.selectedEntity.get(this.selectedTableView),
                checkBoxEvent: checkBoxEvent,
                entityDetails: entityDetails
            } as SelectionDetails
        });
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

    private emitSelectedEntities(checkboxSelected: SelectedRatingRecommendationEntities) {
        if (checkboxSelected) {
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
}

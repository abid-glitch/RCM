import {
  AfterViewInit, ChangeDetectionStrategy, Component, EventEmitter, Input,
  OnDestroy, OnInit, Output
} from '@angular/core';
import { BehaviorSubject, Subject, merge, of, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap, takeUntil, tap } from 'rxjs/operators';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';

// ==== keep your original imports (types/enums/interfaces/pipes) ====
import {
  CustomDebt, CustomRatingClass, RatingRecommendationUpdatedAction,
  RecommendationDropDownOption, SelectedRatingRecommendationEntities, SelectionDetails
} from '../../interfaces';
import { RatingRecommendationTableView } from '../../enums/rating-recommendation.enum';
import { RecommendationInputTypes } from '../../enums';
import { BluePopoverEvent, BlueTableCheckboxScope, BlueTableData, BlueTableRowData } from '@moodys/blue-ng';
import { BlueInputConst } from '@moodys/blue-ng/lib/util';
import { BlueIconName } from '@moodys/blue-ng/tmp/icons/ts/blue-icon-name';
import { getRatingClassIdentifier } from '@features/rating-recommendation';
import { RatingClassMetadata } from '@app/shared/models/RatingClassMetadata';
import {
  CustomRatingClassData, CustomRatingClassDataComicile, CustomRatingClassState
} from '../../models/custom-rating-class-state';
import { CustomDebtData, CustomDebtState } from '../../models/custom-debt-state';
import { LocalizedDatePipe } from '@app/shared/pipes/localized-date.pipe';

type EntityId = string;
type ChildId = string;

@Component({
  selector: 'app-recommendation-table',
  templateUrl: './recommendation-table.component.html',
  styleUrls: ['./recommendation-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecommendationTableComponent implements OnInit, OnDestroy, AfterViewInit {
  // ====== unchanged public API ======
  @Input() ratingRecommendation!: BlueTableData;
  @Input() selectedTableView!: RatingRecommendationTableView;
  @Input() recommendationsDropdownOptionMapping!: RecommendationDropDownOption;
  @Input() isFigBanking!: boolean;
  @Input() continueClicked = false;

  @Input() customRatingClassesState: Record<string, CustomRatingClassState>;
  private _customRatingClasses: CustomRatingClass[] = [];
  @Input() set customRatingClasses(value: CustomRatingClass[]) {
    this._customRatingClasses = value;
    this._onRatingClassChanged();
  }
  @Input() ratingsMetadataLookup: RatingClassMetadata[] = [];
  @Input() isCommitteeWorkflow = false;

  @Input() customDebtsState: Record<string, CustomDebtState>;
  private _customDebts: CustomDebt[] = [];
  @Input() set customDebts(value: CustomDebt[]) {
    this._customDebts = value;
    this._onDebtsChanged();
  }

  @Output() selectedEntityChanged = new EventEmitter<SelectedRatingRecommendationEntities>();
  @Output() recommendationChange = new EventEmitter<RatingRecommendationUpdatedAction<Record<string, any>>>();
  @Output() updatedRatingRecommendation = new EventEmitter<BlueTableData>();
  @Output() ratingClassRemoved = new EventEmitter<string>();
  @Output() ratingClassChanged = new EventEmitter<CustomRatingClassData>();
  @Output() debtRemoved = new EventEmitter<string>();
  @Output() debtChanged = new EventEmitter<CustomDebtData>();

  // ====== constants / ui helpers ======
  readonly tableViewType = RatingRecommendationTableView;
  readonly checkboxScope = BlueTableCheckboxScope;
  readonly inputTypes = RecommendationInputTypes;
  readonly reviewStatus = RecommendationInputTypes.REVIEW_STATUS;
  readonly popoverEvent = BluePopoverEvent;
  readonly removeIcon: BlueInputConst<typeof BlueIconName> = 'trash';

  // ====== forms (unchanged) ======
  ratingClassForm: FormGroup;
  debtForm: FormGroup;

  // ====== checkbox state management (REWRITTEN) ======
  /** parentId -> list of childIds */
  private parentToChildren = new Map<EntityId, ChildId[]>();
  /** anyId -> checked boolean */
  private checked = new Map<string, boolean>();
  /** parentId -> indeterminate boolean */
  private indeterminate = new Map<EntityId, boolean>();

  // selections/events plumbing
  selectedEntity = new Map<RatingRecommendationTableView, BlueTableData>();
  manageCheckboxSelected = new BehaviorSubject<SelectedRatingRecommendationEntities | null>(null);
  private unSubscribe = new Subject<void>();
  private initializeSelectedDebtView = false;

  // stream state for custom rows
  private customRatingClasses$ = new BehaviorSubject<{ identifier: string; domicile: { code: string; name: string } }[]>(
    []
  );
  private customDebts$ = new BehaviorSubject<
    { entityId: string; identifier: string; domicile: { code: string; name: string } }[]
  >([]);

  readonly minMaturityDate: Date = new Date(new Date().setHours(0, 0, 0, 0));

  constructor(private readonly fb: FormBuilder, private readonly datePipe: LocalizedDatePipe) {
    this.ratingClassForm = this.fb.group({});
    this.debtForm = this.fb.group({});
    this._initializeCustomRatingClassFormChanges();
    this._initializeCustomDebtFormChanges();
  }

  // ====== lifecycle ======
  ngOnInit(): void {
    this.initCheckboxStreams();
    this.buildParentChildIndex(); // <<< important: normalize IDs once
  }

  ngAfterViewInit(): void {
    this.initializeSelected();
    this.initializeSelectedDebtView = true;
  }

  ngOnDestroy(): void {
    this.unSubscribe.next();
    this.unSubscribe.complete();
  }

  // ====== ID helpers (consistent everywhere) ======
  private getParentId(e: any): EntityId {
    return (e?.id ?? e?.data?.id ?? '').toString();
  }
  private getChildId(parentId: EntityId, child: any): ChildId {
    const cid = (child?.identifier ?? child?.id ?? child?.data?.identifier ?? '').toString();
    return `${parentId}::${cid}`;
  }
  private isParentRow(details: any): boolean {
    return !details?.immediateParent;
  }

  // ====== index builder ======
  private buildParentChildIndex(): void {
    this.parentToChildren.clear();
    (this.ratingRecommendation || []).forEach((entity: any) => {
      const pid = this.getParentId(entity);
      const children = (entity?.children || []).map((c: any) => this.getChildId(pid, c));
      this.parentToChildren.set(pid, children);
      // initialize all to false
      this.checked.set(`P::${pid}`, false);
      children.forEach((cid) => this.checked.set(`C::${cid}`, false));
      this.indeterminate.set(pid, false);
    });
  }

  // ====== checkbox public API for template ======
  isChecked(details: any): boolean {
    if (this.isParentRow(details)) {
      return this.checked.get(`P::${this.getParentId(details)}`) === true;
    }
    const pid = this.getParentId(details.immediateParent);
    const cid = this.getChildId(pid, details);
    return this.checked.get(`C::${cid}`) === true;
  }

  isIndeterminate(details: any): boolean {
    if (!this.isParentRow(details)) return false;
    return this.indeterminate.get(this.getParentId(details)) === true;
  }

  // ====== checkbox event handlers ======
  onCheckboxChange(evt: { checked: boolean; scope: BlueTableCheckboxScope }, details: any): void {
    const isChecked = !!evt?.checked;

    if (this.isParentRow(details)) {
      const pid = this.getParentId(details);
      this.setParentAndChildren(pid, isChecked);
    } else {
      const pid = this.getParentId(details.immediateParent);
      const cid = this.getChildId(pid, details);
      this.checked.set(`C::${cid}`, isChecked);
      this.recomputeParentFromChildren(pid); // <<< fixes your bug on DESELECT
    }

    // bubble to consumers (kept from your original)
    this.manageCheckboxSelected.next({
      [this.selectedTableView]: {
        blueTableData: this.selectedEntity.get(this.selectedTableView),
        checkBoxEvent: evt,
        entityDetails: details
      } as SelectionDetails
    });
  }

  /** Sets parent + all children, and clears indeterminate */
  private setParentAndChildren(parentId: EntityId, checked: boolean): void {
    this.checked.set(`P::${parentId}`, checked);
    (this.parentToChildren.get(parentId) || []).forEach((cid) => this.checked.set(`C::${cid}`, checked));
    this.indeterminate.set(parentId, false);
  }

  /** Recomputes parent checked/indeterminate from its children */
  private recomputeParentFromChildren(parentId: EntityId): void {
    const kids = this.parentToChildren.get(parentId) || [];
    const total = kids.length;
    const selected = kids.filter((cid) => this.checked.get(`C::${cid}`) === true).length;

    if (selected === 0) {
      this.checked.set(`P::${parentId}`, false);
      this.indeterminate.set(parentId, false);
    } else if (selected === total) {
      this.checked.set(`P::${parentId}`, true);
      this.indeterminate.set(parentId, false);
    } else {
      this.checked.set(`P::${parentId}`, false);
      this.indeterminate.set(parentId, true);
    }
  }

  // ====== (kept) selection plumbing & misc methods ======
  onEntityTableSelect(selectedEntity: BlueTableData) {
    this.selectedEntity.set(this.selectedTableView, selectedEntity);
    if (this.initializeSelectedDebtView && this.selectedTableView === RatingRecommendationTableView.Debt) {
      this.initializeSelected();
      this.initializeSelectedDebtView = false;
    }
  }

  private initCheckboxStreams(): void {
    this.manageCheckboxSelected
      .pipe(
        debounceTime(120),
        tap((payload) => this.emitSelectedEntities(payload)),
        takeUntil(this.unSubscribe)
      )
      .subscribe();
  }

  private emitSelectedEntities(payload: SelectedRatingRecommendationEntities | null) {
    if (!payload) return;
    const selectedEntities: SelectedRatingRecommendationEntities = {
      [this.selectedTableView]: {
        ...payload[this.selectedTableView],
        blueTableData: this.selectedEntity.get(this.selectedTableView)
      }
    };
    this.selectedEntityChanged.emit({ ...selectedEntities });
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

  // ====== remainder of your original (rating class/debt forms & events) ======
  updateRecommendationEventEmitter(
    event: RatingRecommendationUpdatedAction<Record<string, any>>,
    row: BlueTableRowData
  ) {
    row.data = { ...event.rating };
    this.recommendationChange.emit(event);
    this.updatedRatingRecommendation.emit(this.ratingRecommendation);
  }

  onRatingClassRemoved(identifier: string) { this.ratingClassRemoved.emit(identifier); }
  onDebtRemoved(identifier: string) { this.debtRemoved.emit(identifier); }

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
      const group = this.fb.group({
        ratingClass: {},
        name,
        originalFaceAmount,
        currencyCode,
        maturityDate: maturityDate ? new Date(maturityDate) : null
      });
      this.debtForm.addControl(identifier, group);
      this.customDebts$.next([...this.customDebts$.value, { ...customDebt, identifier, domicile }]);

      if (value !== '') {
        const lookup = this.ratingsMetadataLookup.find((m) => m.ratingClassName === value);
        if (lookup) group.get('ratingClass')!.setValue(lookup);
      }
    }
  }

  private _onRatingClassChanged() {
    this._customRatingClasses.forEach(this._setCustomRatingClass.bind(this));
  }
  private _setCustomRatingClass(customRatingClass: CustomRatingClass) {
    const identifier = getRatingClassIdentifier(customRatingClass.ratingClass);
    const domicile = customRatingClass.domicile;
    const ctl = this.getRatingClassFormControl(identifier);
    if (!ctl) {
      const value = customRatingClass.ratingClass.name;
      const control = this.fb.control({ ratingClassName: value });
      this.ratingClassForm.addControl(identifier, control);
      this.customRatingClasses$.next([...this.customRatingClasses$.value, { identifier, domicile }]);

      if (value !== '') {
        const lookup = this.ratingsMetadataLookup.find((m) => m.ratingClassName === value);
        if (lookup) control.setValue(lookup);
      }
    }
  }

  getRatingClassFormControl(identifier: string) { return this.ratingClassForm.controls[identifier] as FormControl; }
  getDebtFormGroup(identifier: string) { return this.debtForm.get(identifier) as FormGroup; }

  private _initializeCustomRatingClassFormChanges() {
    this.customRatingClasses$
      .pipe(
        filter((arr) => arr.length > 0),
        switchMap((arr) =>
          merge(
            ...arr.map((c) => combineLatest([of(c), this.ratingClassForm.get(c.identifier)!.valueChanges]))
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
        filter((arr) => arr.length > 0),
        switchMap((arr) =>
          merge(
            ...arr.map((d) =>
              combineLatest([of(d), this.debtForm.get(d.identifier)!.valueChanges.pipe(distinctUntilChanged())])
            )
          )
        ),
        takeUntil(this.unSubscribe)
      )
      .subscribe(this._onDebtFormChanges.bind(this));
  }

  private _onDebtFormChanges(
    data: [
      { identifier: string; domicile: CustomRatingClassDataComicile; entityId: string },
      { name: string; originalFaceAmount: string; currencyCode: string; maturityDate: string; ratingClass: RatingClassMetadata; }
    ]
  ) {
    const { identifier, domicile, entityId } = data[0];
    const { name, originalFaceAmount, currencyCode, ratingClass } = data[1];
    let maturityDate = data[1].maturityDate;
    if (maturityDate) maturityDate = this.datePipe.transform(new Date(maturityDate).toISOString(), 'YYYY-MM-dd');
    this.debtChanged.emit({
      entityId, identifier, domicile, name, originalFaceAmount, currencyCode, maturityDate,
      ratingClassMetadata: ratingClass
    });
  }

  // search/display helpers (unchanged)
  searchFn = (term: string): RatingClassMetadata[] =>
    this.ratingsMetadataLookup.filter((m) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi').test(m.ratingClassName));
  displayFn = (m: RatingClassMetadata) => m.ratingClassName;

  // (kept) split rating helper
  checkNextForSplitRating(currentIndex: number, currentItem: any): boolean {
    const property = 'name', currencyProperty = 'currency';
    if (currentIndex === 0 || currentIndex === 1) return false;
    if (currentIndex < this.ratingRecommendation[0].children.length - 1) {
      const previousItem = this.ratingRecommendation[0].children[currentIndex + 1];
      return previousItem?.data?.[property] === currentItem?.data?.[property] &&
             previousItem?.data?.[currencyProperty] === currentItem?.data?.[currencyProperty];
    }
    return false;
  }
}

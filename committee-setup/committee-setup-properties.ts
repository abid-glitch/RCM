import {
    Component,
    EventEmitter,
    OnInit,
    Output,
    Renderer2,
    Inject,
    Input,
    ChangeDetectorRef,
    ViewChild
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { addYears, addDays } from 'date-fns';
import { CommitteeMemo } from 'src/app/shared/models/CommittteeMemo';
import { DataService } from 'src/app/shared/services/data.service';
import { EntityService } from 'src/app/shared/services/entity.service';
import { CommitteeReasonType, groupToReasonsMap } from 'src/app/shared/models/CommitteeReasonType';
import { templatesToGroupMap, RatingGroupType } from 'src/app/shared/models/RatingGroupType';
import { TemplateCategoryType } from 'src/app/shared/models/TemplateCategoryType';
import { CommitteeSupport } from 'src/app/shared/models/CommitteeSupport';
import { Methodology } from 'src/app/shared/models/Methodology';
import { BlueMultiselect, BLUE_DATE_ADAPTER, BlueDateAdapter, MultiselectOption } from '@moodys/blue-ng';
import { PRDisclosure } from 'src/app/shared/models/PRDisclosure';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-committee-setup-properties',
    templateUrl: './committee-setup-properties.component.html',
    styleUrls: ['./committee-setup-properties.component.scss']
})
// CODE_DEBT: have setter/getter in data.service to interact with Main Model
export class CommitteeSetupPropertiesComponent implements OnInit {
    prDisclosure: PRDisclosure;

    committeeMemo: CommitteeMemo;
    committeSupport: CommitteeSupport;
    showReasonDropDown: boolean;
    showReasonTextArea: boolean;
    showOtherReasonFlag: boolean;
    selectedTemplateGroup: TemplateCategoryType;
    reasonLabel: string;
    committeNumberOptions: number[];

    selectedRatingComitteeDate: Date;
    //TODO: Move to init method
    dateFormatMMDDYYYY: string;
    dateFormatDDMMMYYYY!: string;
    placement: string;
    minDate: Date;
    maxDate: Date;
    dateFormatYYYYMMDD!: string;
    ratingComitteeDate: Date;
    committeeNumber: number;
    committeeReason: any;
    ratingCommitteeReasonsOptions: MultiselectOption[];

    selectedPrimaryMethodologyFromList: Methodology[] = [];
    selectedPrimaryMethodologyCombined: Methodology[] = [];
    showRatingMethodologyFlag = false;
    selectedMethodologyQuestionsChoice = {};
    showPrimaryMethodologyFlag = true;

    primaryMethodologyRef: BlueMultiselect;
    selectedRatingGroup: RatingGroupType;
    selectedRatingGroupsEnum = RatingGroupType;
    isCamsIDValid = true;
    unSubscribe$ = new Subject<void>();

    @Output()
    primaryMethodologyChange = new EventEmitter<any>();

    @Input() usePrimaryMethodologyRedesign = false;

    @ViewChild('dataSource') dataSource: BlueMultiselect;

    constructor(
        public translateService: TranslateService,
        public dataService: DataService,
        public entityService: EntityService,
        private renderer: Renderer2,
        @Inject(BLUE_DATE_ADAPTER) private _dateAdapter: BlueDateAdapter<Date>,
        private readonly _cdr: ChangeDetectorRef
    ) {
        this.dataService
            .getIsCamsIDInvalid()
            .pipe(takeUntil(this.unSubscribe$))
            .subscribe((data) => {
                if (data) {
                    this.isCamsIDValid = false;
                    this._cdr.detectChanges();
                }
            });
    }

    ngOnInit(): void {
        this.selectedRatingGroup = this.dataService.getSelectedRatingGroup();
        this.initializeDateVariables();
        this.initializeLocalData();
        this.showHideReasonBasedonTemplateGroup(this.dataService.committeSupportWrapper.ratingGroupTemplate);
        this.setReasonIfDropdownIsOther();
        this.initializeRatingCommitteeReasons();
        this.updateRatingCommitteeReasonsOptions(this.committeeMemo.ratingCommitteeReasons);
        setTimeout(() => {
            this.dataSource.close();
        }, 200);
    }

    ngOnDestroy(): void {
        this.unSubscribe$.next();
        this.unSubscribe$.complete();
    }

    private initializeDateVariables() {
        this.dateFormatMMDDYYYY = 'MM/dd/yyyy';
        this.dateFormatDDMMMYYYY = 'dd/MMM/yyyy';
        this.placement = 'bottom-start';
        this.minDate = addDays(new Date(), -1);
        this.maxDate = addYears(this.minDate, 10);
        this.dateFormatYYYYMMDD = 'yyyy-MM-dd';
        this.changeDatePickerFormat(this.dateFormatDDMMMYYYY);
    }

    // change date picker format from default to @param:dateFormat
    changeDatePickerFormat(dateFormat: string) {
        const formats = this._dateAdapter?.formats;
        if (formats?.display) {
            formats.display.dateInput = dateFormat;
            this._dateAdapter.setFormats(formats);
        }
    }

    updateRatingCommitteeReasonsOptions(vals: string[] = []) {
        const periodicReview = 'Periodic Review';
        this.ratingCommitteeReasonsOptions = [];
        this.initializeRatingCommitteeReasons();
        setTimeout(() => {
            if (vals.length == 0 || this.committeeMemo.ratingCommitteeReasons?.length == 0) {
                this._cdr.detectChanges();
                this.dataSource.updateListOptions();
                this.dataSource.close();
                this.dataSource.open();
                return;
            }

            if (vals.includes(periodicReview) || this.committeeMemo.ratingCommitteeReasons?.includes(periodicReview)) {
                this.ratingCommitteeReasonsOptions = this.ratingCommitteeReasonsOptions.filter(
                    (reason) => reason.value == periodicReview
                );
            } else {
                this.ratingCommitteeReasonsOptions = this.ratingCommitteeReasonsOptions.filter(
                    (reason) => reason.value !== periodicReview
                );
            }
            this._cdr.detectChanges();
            this.dataSource.updateListOptions();
            this.dataSource.close();
            setTimeout(() => {
                this.dataSource.open();
            }, 0);
        }, 0);
    }

    filterFn = (option: MultiselectOption, input: string): boolean => {
        const data =
            !input?.trim() ||
            option.label.toLowerCase().includes(input.trim().toLowerCase()) ||
            input.trim().toLowerCase() == 'periodic review';

        return data;
    };

    initializeRatingCommitteeReasons() {
        this.ratingCommitteeReasonsOptions =
            this.reasonsForGroupC(this.dataService.committeSupportWrapper.ratingGroupTemplate)?.map((data) =>
                this.transformToMultiSelectOption(data)
            ) || [];
    }

    private initializeLocalData() {
        this.committeSupport = this.dataService.committeSupportWrapper;
        this.prDisclosure = this.dataService.committeSupportWrapper.pressReleaseDisclosures;
        this.committeeMemo = this.committeSupport.committeeMemoSetup;

        if (this.committeeMemo?.reason != undefined && this.committeeMemo?.reason != '') {
            this.populateDropdownValue();
        }
        this.ratingComitteeDate = this.dataService.getRatingCommitteeDate();
        this.committeeNumber = this.committeSupport.ratingCommitteeInfo?.number;
        this.committeNumberOptions = [1, 2, 3];
        this.showOtherReasonFlag = false;

        this.reasonLabel = this.translateService.instant('committeeSetupProperties.committeeReason.label');
    }

    showHideReasonBasedonTemplateGroup(selectedGroup: RatingGroupType) {
        this.selectedTemplateGroup = templatesToGroupMap[selectedGroup];

        switch (this.selectedTemplateGroup) {
            case TemplateCategoryType.groupB:
                this.showReasonTextArea = true;
                this.reasonLabel = this.translateService.instant(
                    'committeeSetupProperties.committeeReason.changedLabel'
                );
                break;
            case TemplateCategoryType.groupC1:
            case TemplateCategoryType.groupC2:
            case TemplateCategoryType.groupC3:
            case TemplateCategoryType.groupA:
                this.showReasonDropDown = true;
                break;
            default:
                this.showReasonDropDown = false;
                this.showReasonTextArea = false;
                this.showOtherReasonFlag = false;
                break;
        }
        return true;
    }

    committeeReasonChange() {
        if (this.committeeReason != CommitteeReasonType.Other) {
            this.committeeMemo.reason = this.committeeReason;
            this.dataService.committeSupportWrapper.committeeMemoSetup.reason = this.committeeReason;
        } else {
            this.committeeMemo.reason = '';
            this.dataService.committeSupportWrapper.committeeMemoSetup.reason = '';
        }
    }

    populateDropdownValue() {
        const isOtherOption: boolean =
            Object.values(CommitteeReasonType).findIndex(() => this.committeeMemo.reason) == -1;
        if (isOtherOption) {
            this.committeeReason = CommitteeReasonType.Other;
        } else {
            this.committeeReason = this.committeeMemo.reason;
        }
    }

    updateModelWithOtherReason() {
        this.dataService.committeSupportWrapper.committeeMemoSetup.reason = this.committeeMemo.reason;
    }

    updateModel() {
        this.dataService.committeSupportWrapper.committeeMemoSetup = this.committeeMemo;
        this.dataService.setRatingCommitteeDate(this.ratingComitteeDate, this.dateFormatYYYYMMDD);
        this.dataService.committeSupportWrapper.ratingCommitteeInfo.number = this.committeeNumber;
        this.dataService.setIsSaveClicked(false);
        this.isCamsIDValid = true;
    }

    public get isAllRequiredInputValid(): boolean {
        return this.committeeMemo.conflictCheckId && this.committeeNumber > 0;
    }

    reasonsForGroupC(selectedTemplate: RatingGroupType) {
        this.selectedTemplateGroup = templatesToGroupMap[selectedTemplate];
        return groupToReasonsMap[this.selectedTemplateGroup];
    }

    public handleBlurEvent(multiselectRef: any) {
        this.dataService.onBlurEventListener(multiselectRef, this.renderer);
    }

    setReasonIfDropdownIsOther() {
        if (!this.showReasonDropDown) {
            return;
        }
        const { reason } = this.dataService.committeSupportWrapper.committeeMemoSetup;
        const findReason = groupToReasonsMap[this.selectedTemplateGroup].find((reasons) => reasons === reason);
        if (!findReason && reason) {
            this.committeeReason = CommitteeReasonType.Other;
        }
    }

    get committeeReasonType() {
        return CommitteeReasonType;
    }

    openIfFocused(multiselect: BlueMultiselect) {
        this.dataService.onBlurEventListener(multiselect, this.renderer);
        multiselect.open();
    }

    showRatingMethodologyQuestions(showRatingQuestions: boolean = undefined): void {
        this.showRatingMethodologyFlag = showRatingQuestions;
    }

    updatePrimaryMethodologyFromList(methodologyList: Methodology[]) {
        this.selectedPrimaryMethodologyFromList = methodologyList;
        this.primaryMethodologyChange.emit();
    }

    updatePrimaryMethodologyRef(methodologyRef: BlueMultiselect) {
        this.primaryMethodologyRef = methodologyRef;
        this.primaryMethodologyChange.emit();
    }

    updatePrDisclosureMoreInfoAndArabic(selectedPrDisclosure: PRDisclosure) {
        this.prDisclosure.moreInfoThanSelectedMethodology = selectedPrDisclosure.moreInfoThanSelectedMethodology;
        this.prDisclosure.arabicTranslatedDomicileKSA = selectedPrDisclosure.arabicTranslatedDomicileKSA;
    }

    updateDisplayedMethodology(methodologyList: Methodology[]) {
        this.selectedPrimaryMethodologyCombined = methodologyList;
    }

    private transformToMultiSelectOption(data) {
        return { label: data, value: data };
    }
}

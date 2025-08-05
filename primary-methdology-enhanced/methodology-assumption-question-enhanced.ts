import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnInit,
    Output,
    SimpleChanges
} from '@angular/core';
import { Methodology } from '../../../../shared/models/Methodology';
import { BlueFieldLabelPosition } from '@moodys/blue-ng';
import { MethodologySensitivities } from '../../../../shared/models/MethodologySensitivities';
import {
    CreditRatingModelOptions,
    modelOptionsList,
    PRDisclosureCheckBoxActions,
    UpdateDisclosureParams
} from '../../interfaces/methodology-assumptions.interface';
import { JurisdictionDetail } from '../../../../shared/models/regionJurisdictionDetails';
import { Router } from '@angular/router';
import { PRDisclosure } from '../../../../shared/models/PRDisclosure';
import { MethodologyCheckBoxOptionType } from '../../enums/enums';
import { RatingGroupType } from 'src/app/shared/models/RatingGroupType';
import { AppRoutes } from '../../../../routes/routes';
import { DataService } from '@app/shared/services/data.service';
import { FeatureFlagService } from '@app/shared/services/feature-flag.service';


@Component({
    selector: 'app-methodology-assumption-questions-enhanced',
    templateUrl: './methodology-assumption-questions-enhanced.component.html',
    styleUrls: ['./methodology-assumption-questions-enhanced.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MethodologyAssumptionQuestionsEnhancedComponent implements OnInit, OnChanges {
    @Input() isRatingCommitteeClose = false;
    @Input() isActionRequestFormSetup = false;
    @Input() selectedMethodologyList?: Methodology[];
    @Output() manageMethodology = new EventEmitter<Methodology>();
    @Output() updateMethodologyDisclosure = new EventEmitter<UpdateDisclosureParams>();

    @Input() methodologyJurisdiction?: JurisdictionDetail;
    @Input() prDisclosure = new PRDisclosure();
    @Input() selectedRatingGroup!: RatingGroupType;

    @Output() updatePrDisclosure = new EventEmitter<PRDisclosure>();

    readonly labelPosition = BlueFieldLabelPosition;
    readonly checkBoxOptionType = MethodologyCheckBoxOptionType;

    readonly allMethodologySensitivities: MethodologySensitivities[] = Object.values(MethodologySensitivities);
    options: CreditRatingModelOptions[] = modelOptionsList;

    @Output() sectionIsValid = new EventEmitter<boolean>();
    @Output() methodologyCheckBoxAction = new EventEmitter<PRDisclosureCheckBoxActions>();

    isRatingCommitteeMemo = false;
    isRatingCommitteeWorkflow = false;

    arabicTranslatedDomicileKSA = false;
    moreInfoThanSelectedMethodology = false;
    RatingGroupsEnum = RatingGroupType;

    constructor(private router: Router, private featureFlagService: FeatureFlagService, private dataService: DataService) {}

    ngOnChanges(changes: SimpleChanges): void {
        if (changes.selectedMethodologyList && changes.selectedMethodologyList.currentValue) {
            if (!this.isRatingGroupSFGPrimaryOrSFGCoveredBonds()) this.manageSectionValidity();
        }
    }

    removeMethodology(methodology: Methodology) {
        this.manageMethodology.emit(methodology);
    }

    ngOnInit(): void {
        this.isRatingCommitteeWorkflow = this.featureFlagService.isCommitteeWorkflowEnabled(
            this.dataService.committeSupportWrapper
        );
        this.setShowKsaPopupOnInitialQuestion();
    }

    manageSectionValidity() {
        if (
             this.isRatingCommitteeWorkflow
        ) {
            this.sectionIsValid.emit(true);
        } else {
            const sectionIsValid = this.selectedMethodologyList?.find((methodology) => {
                return methodology?.creditRatingUsed === undefined;
            });
            this.sectionIsValid.emit(!sectionIsValid);
        }
    }

    manageOnCheckBoxChecked(actionType: MethodologyCheckBoxOptionType): void {
        this.methodologyCheckBoxAction.emit({ prDisclosure: this.prDisclosure, actionType: actionType });
    }

    private setShowKsaPopupOnInitialQuestion(): void {
        this.isRatingCommitteeMemo = this.router.url.includes(AppRoutes.COMMITTEE_SETUP_PROPERTIES);
    }

    onChangeDisclosure(ev: Event, methodology: Methodology) {
        const selectedDisclosure = (ev.target as HTMLInputElement).value;
        this.updateMethodologyDisclosure.emit({
            methodology: methodology,
            disclosure: selectedDisclosure as MethodologySensitivities,
            isUserSelection: true
        });
    }

    isRatingGroupSFGPrimaryOrSFGCoveredBonds() {
        return (
            this.selectedRatingGroup === RatingGroupType.SFGCoveredBonds ||
            this.selectedRatingGroup === RatingGroupType.SFGPrimary
        );
    }
}

import { Component, EventEmitter, HostBinding, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { AssetBackedSecuritiesType } from 'src/app/shared/models/AssetBackedSecuritiesType';
import { ActionSetupRatingComitteeQuestionaire } from 'src/app/shared/models/ActionSetupRatingComitteeQuestionaire';
import { DataService } from 'src/app/shared/services/data.service';
import { FeatureFlagService } from 'src/app/shared/services/feature-flag.service';
import { YesNoUnknown } from 'src/app/shared/models/YesNoUnknown';
import { SplitTreatments } from 'src/app/shared/models/SplitTreatment';
import { RatingGroupType } from 'src/app/shared/models/RatingGroupType';
import { JurisdictionDetail } from 'src/app/shared/models/regionJurisdictionDetails';
import { Observable, Subscription } from 'rxjs';
import { SmartDefaultsService } from '../sov-smart-default-popup/smart-defaults.service';
import { take } from 'rxjs/operators';
import { EntityService } from '../../shared/services/entity.service';

@Component({
    selector: 'app-initial-questions',
    templateUrl: './initial-questions.component.html',
    styleUrls: ['./initial-questions.component.scss']
})
export class InitialQuestionsComponent implements OnInit, OnDestroy {
    @HostBinding('attr.id') role = 'questionnaireSection';

    questionnaire: ActionSetupRatingComitteeQuestionaire;
    private selectedRegion: JurisdictionDetail;
    selectedRatingGroup: RatingGroupType;

    @Input()
    showSovDefaultResponse: Observable<boolean>;

    @Output() sectionIsValid = new EventEmitter<boolean>();

    private subscriptions: Subscription[] = [];
    constructor(
        private dataService: DataService,
        private featureFlagService: FeatureFlagService,
        private smartDefaultsService: SmartDefaultsService,
        private entityService: EntityService
    ) {}

    ngOnInit(): void {
        this.selectedRegion = this.dataService.getRegionJurisdiction();
        this.questionnaire = this.dataService.committeSupportWrapper.initialQuestions;
        this.selectedRatingGroup = this.dataService.getSelectedRatingGroup();
        if (!this.questionnaire) {
            this.questionnaire = new ActionSetupRatingComitteeQuestionaire();
            this.questionnaire.disclosuresApplyToAllIssuers = YesNoUnknown.Yes;
            //CODE_DEBT: Split flag is no more, has to clean up
            if (this.featureFlagService.getTreatmentState(SplitTreatments.COMMON_ANSWERS_DEFAULTED)) {
                this.questionnaire.assetBackedSecurities = AssetBackedSecuritiesType.NonAbs;
                this.questionnaire.pointInTimeOrDebtorInPossession = YesNoUnknown.No;
                this.questionnaire.saudiRegistered = YesNoUnknown.No;
            }
        }

        this.manageEntityDrivenDefaultsAnswers();

        this.smartDefaultsService.usingSmartDefaultMethodology$.pipe(take(1)).subscribe((isUsingSmartDefault) => {
            if (!isUsingSmartDefault) {
                if (!this.dataService.committeSupportWrapper.initialQuestions) {
                    this.initializeConditionalAnswerDefaulting();
                    this.updateModel();
                }
            }
        });

        const sovSubscription: Subscription = this.showSovDefaultResponse.subscribe((userAccepted) => {
            this.defaultQuestionForSovAndSovMDB(userAccepted);
            this.updateModel();
        });
        this.subscriptions.push(sovSubscription);
    }

    //CODE_DEBT: Create Map to hold default values
    private initializeConditionalAnswerDefaulting() {
        this.questionnaire.disclosuresApplyToAllIssuers = YesNoUnknown.Yes;
        switch (this.selectedRatingGroup) {
            case RatingGroupType.SFGPrimary:
                this.questionnaire.saudiRegistered = this.questionnaire.saudiRegistered || YesNoUnknown.No;
                this.questionnaire.assetBackedSecurities =
                    this.questionnaire.assetBackedSecurities || AssetBackedSecuritiesType.NonAbs;
                this.questionnaire.passThrough = this.questionnaire.passThrough || YesNoUnknown.No;
                break;
            case RatingGroupType.NonBanking:
            // case RatingGroupType.BondFunds:
            // case RatingGroupType.MoneyMarketFunds:
                this.questionnaire.disclosuresApplyToAllIssuers = YesNoUnknown.No;
                break;
            case RatingGroupType.SovereignBond:
            case RatingGroupType.SovereignMDB:
                this.questionnaire.assetBackedSecurities = null;
        }
        this.questionnaire.passThrough = this.dataService.committeSupportWrapper.ratingCommitteeMemo
            ? YesNoUnknown.No
            : undefined;
    }

    private defaultQuestionForSovAndSovMDB(userAccepted: boolean) {
        if (userAccepted) {
            this.questionnaire = {
                ...this.questionnaire,
                assetBackedSecurities: AssetBackedSecuritiesType.NonAbs,
                passThrough: YesNoUnknown.No
            };
        }
    }

    get assetBackedSecuritiesTypes() {
        return Object.values(AssetBackedSecuritiesType);
    }

    get yesNoOptions() {
        return Object.values(YesNoUnknown).filter((val) => val != YesNoUnknown.Unknown);
    }

    private manageEntityDrivenDefaultsAnswers(): void {
        if (this.entityService.entityWasUpdated) {
            this.questionnaire.singleLeadAnalyst = this.dataService.isSelectedOrgAnalystSame
                ? YesNoUnknown.Yes
                : YesNoUnknown.No;

            this.loadSingleIssuerOfFamilyQuestion();
            /*Reset entity state to false */
            this.entityService.manageEntityWasUpdatedStatus(false);
        }
    }

    private loadSingleIssuerOfFamilyQuestion() {
        if (this.selectedRatingGroup === RatingGroupType.SFGCoveredBonds) {
            this.questionnaire.singleIssuerOrFamily =
                this.entityService.selectedOrgTobeImpacted?.length == 1 ? YesNoUnknown.Yes : YesNoUnknown.No;
        } else {
            this.questionnaire.singleIssuerOrFamily = this.dataService.isSelectedOrgParentSame
                ? YesNoUnknown.Yes
                : YesNoUnknown.No;
        }
    }

    public initialQuestionEnabled(name: string) {
        let enableFlag = false;
        const ratinggroups = this.dataService.initialQuestionObject[name]?.ratingGroupTemplates;
        const validRegions = this.dataService.initialQuestionObject[name]?.regions;

        if (ratinggroups != null) {
            enableFlag =
                ratinggroups.includes(this.dataService.committeSupportWrapper.ratingGroupTemplate) &&
                validRegions.includes(this.selectedRegion?.name);
        }
        return enableFlag;
    }

    public updateModel() {
        this.dataService.updateInitialQuestions(this.questionnaire);
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((sub) => sub.unsubscribe);
    }
}

import { ChangeDetectionStrategy, Component, HostBinding, OnInit, ViewChild } from '@angular/core';
import { CommitteeMemoQuestionsComponent } from 'src/app/features/committee-memo-questions/committee-memo-questions.component';
import { CommitteeSetupPropertiesComponent } from 'src/app/features/committee-setup-properties/committee-setup-properties.component';
import { KeyFactualElementsComponent } from 'src/app/features/key-factual-elements/key-factual-elements.component';
import { CommitteeMemo } from 'src/app/shared/models/CommittteeMemo';
import { RatingGroupType } from 'src/app/shared/models/RatingGroupType';
import { DataService } from 'src/app/shared/services/data.service';
import { EntityService } from 'src/app/shared/services/entity.service';
import { MethodologyService } from 'src/app/shared/services/methodology.service';
import { AppRoutes } from '../routes';
import { GenerationService } from 'src/app/shared/services/document-generation.service';
import { Entity } from 'src/app/shared/models/Entity';
import { CommitteeSupport } from '../../shared/models/CommitteeSupport';
import { RatingTemplate } from '../../shared/models/RatingTemplate';
import { SplitTreatments } from 'src/app/shared/models/SplitTreatment';
import { FeatureFlagService } from '../../shared/services/feature-flag.service';
import { PrDisclosureComponent } from 'src/app/features/pr-disclosure/pr-disclosure.component';
import { EsgConsiderationsComponent } from 'src/app/features/esg-considerations/esg-considerations.component';
import { DebtInformationComponent } from '../../features/debt-information/debt-information.component';
import { ReviewDirections } from '../../shared/models/ReviewDirections';
import { NavButtonMetadata } from '../../shared/components/bottom-navbar';
import { YesNoUnknown } from '@app/shared/models/YesNoUnknown';
import { UnSavedChanges } from '@app/shared/models/UnSavedChanges';
import _, { omit } from 'lodash';
import { Methodology } from '@app/shared/models/Methodology';
import { PrimaryMethodologyService } from '@app/features/primary-methodology-enhanced/services/primary-methodology.service';
import { RatingsTableMode } from '@app/features/rating-recommendation/enums/rating-recommendation.enum';
import { BottomNavbarComponent } from '@app/shared/components/bottom-navbar/bottom-navbar.component';

@Component({
    selector: 'app-committee-setup',
    templateUrl: './committee-setup.component.html',
    styleUrls: ['./committee-setup.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommitteeSetupComponent implements OnInit, UnSavedChanges {
    @HostBinding('attr.id') role = 'rcmCommitteeSetupPage';

    @ViewChild(CommitteeMemoQuestionsComponent)
    committeMemoQuestion: CommitteeMemoQuestionsComponent;

    @ViewChild(CommitteeSetupPropertiesComponent)
    committeSetupProperties: CommitteeSetupPropertiesComponent;

    @ViewChild(KeyFactualElementsComponent)
    keyFactualElements: KeyFactualElementsComponent;

    @ViewChild(PrDisclosureComponent, { static: true })
    prDisclosureComponent: PrDisclosureComponent;

    @ViewChild(EsgConsiderationsComponent, { static: false })
    public esgConsideration: EsgConsiderationsComponent;

    @ViewChild(DebtInformationComponent, { static: false })
    public debtInformationComponent: DebtInformationComponent;

    @ViewChild(BottomNavbarComponent, { static: false })
    public bottomNavBar: BottomNavbarComponent;

    public showNewApproachOnNavBar: boolean;
    public showEsgQuesetions: boolean;
    showReviewSectionQuestion = true;

    showMethodologyRedesignedComponent = false;
    methodologySectionIsValid = true;

    selectedReviewDirections: ReviewDirections[] =
        this.dataService.committeSupportWrapper.regulatoryDisclosures.reasonForReviewAction ?? [];

    appRoutes = AppRoutes;
    buttonMetadata!: NavButtonMetadata;
    flagRatingRecommendationTable = false;
    selectedRatingGroup: RatingGroupType = this.dataService.getSelectedRatingGroup();
    methodologyChanged: Methodology[];

    constructor(
        public dataService: DataService,
        public featureFlagService: FeatureFlagService,
        public methodologyService: MethodologyService,
        public entityService: EntityService,
        public generationService: GenerationService,
        public primaryMethodologyService: PrimaryMethodologyService
    ) {}
    hasUnsavedChanges: boolean;
    saveChanges() {
        this.updateModel();
    }

    readonly isRatingCommitteeWorkflow = this.featureFlagService.isCommitteeWorkflowEnabled(
        this.dataService.committeSupportWrapper
    );
    readonly isSovRatingCommitteeWorkflow = this.featureFlagService.isSOVCommitteeWorkflowEnabled(
        this.dataService.committeSupportWrapper
    );
    readonly isSubSovRatingCommitteeWorkflow = this.featureFlagService.isSUBSOVCommitteeWorkflowEnabled(
        this.dataService.committeSupportWrapper
    );
    readonly isSovMdbRatingCommitteeWorkflow = this.featureFlagService.isSOVMDBCommitteeWorkflowEnabled(
        this.dataService.committeSupportWrapper
    );

    discardChanges() {
        this.dataService.committeSupportWrapper = _.cloneDeep(
            this.dataService.initialCommitteeSupport
        );
        if(this.methodologyChanged){
            this.methodologyChanged.forEach(methodology => {
                this.primaryMethodologyService.addSelectedMethodologyToList(methodology);
            });
        }
    }

    committeeInfo: CommitteeMemo;
    committeeSupportWrapper: CommitteeSupport;
    RatingGroupsEnum = RatingGroupType;

    public isFIGTemplateSelected: boolean;

    ngOnInit(): void {
        this.committeeSupportWrapper = this.dataService.committeSupportWrapper;
        this.committeeInfo = this.committeeSupportWrapper.committeeMemoSetup;
        this.dataService.initialCommitteeSupport = _.cloneDeep(
            this.committeeSupportWrapper
        );
        this.featureFlagService.featureFlags$.subscribe((isFlagOn) => {
            if (isFlagOn) {
                this.showNewApproachOnNavBar = this.featureFlagService.getTreatmentState(
                    SplitTreatments.GENERATE_AT_END_OF_FLOW
                );
                this.showEsgQuesetions = this.featureFlagService.getTreatmentState(
                    SplitTreatments.SHOW_RCM_ESG_QUESTION
                );
                if (this.featureFlagService.getTreatmentState(SplitTreatments.ONLINE_RATING_RECOMMENDATION_TABLE)) {
                    this.flagRatingRecommendationTable = true;
                }

                this.showMethodologyRedesignedComponent = this.featureFlagService.getTreatmentState(
                    SplitTreatments.METHODOLOGY_UX_REDESIGN
                );
            }
        });
        this.showReviewSectionQuestion = this.showReviewSection();
        this.isFIGTemplateGroup();
        /*Generate Button MetaData*/
        this.setNavButtonMetadata();
    }

    navBack() {
        if (this.isFIGTemplateSelected) {
            const selectedEntities: Entity[] = [];
            this.entityService.selectedOrgTobeImpacted.forEach((org) =>
                selectedEntities.push(
                    new Entity({ id: org.id, name: org.name, type: org.type, analysts: org.analysts } as Entity)
                )
            );
            this.dataService.updateSelectedEntities(selectedEntities);
        }
        this.showUnsavedChangesModal();
    }

    private showUnsavedChangesModal() {
        const initialCommitteeSupport = this.dataService.initialCommitteeSupport;
        //*Making the initial state same as current for the first time page loading
        if (!initialCommitteeSupport.committeeMemoSetup?.crqt)
            initialCommitteeSupport.committeeMemoSetup.crqt = [];
        if(initialCommitteeSupport.committeeMemoSetup.exoticOrBespokeConsidered === YesNoUnknown.Unknown)
            initialCommitteeSupport.committeeMemoSetup.exoticOrBespokeConsidered = undefined;
        if(!initialCommitteeSupport.pressReleaseDisclosures.relevantESGFactors)
            initialCommitteeSupport.pressReleaseDisclosures.relevantESGFactors = [];
        const currentCommitteeSupport = this.committeeSupportWrapper;
        if (!this.areSelectedCommitteeSupportPropsEqual(initialCommitteeSupport, currentCommitteeSupport)) {
            this.hasUnsavedChanges = true;
        } else {
            this.hasUnsavedChanges = false;
            this.resetMethodologySector();
        }
    }

    areSelectedCommitteeSupportPropsEqual(
        initial: CommitteeSupport,
        current: CommitteeSupport
    ): boolean {
        // Helper to omit disclosure and isUserSelection from methodologies because that is of no use for our comparison
        const cleanMethodologies = (methodology: Methodology[]) =>
            methodology?.map(m => omit(m, ['disclosure', 'isUserSelection'])) ?? [];

        // Building objects with only the properties we want to compare
        const pickProps = (committeeSupport: CommitteeSupport) => ({
            committeeMemoSetup: committeeSupport.committeeMemoSetup,
            methodologies: cleanMethodologies(committeeSupport.methodologies),
            ratingCommitteeInfo: committeeSupport.ratingCommitteeInfo,
            pressReleaseDisclosures: committeeSupport.pressReleaseDisclosures,
            regulatoryDisclosures: committeeSupport.regulatoryDisclosures
        });
        this.methodologyChanged = _.xorWith(
            cleanMethodologies(initial.methodologies),
            cleanMethodologies(current.methodologies),
            _.isEqual
        );

        return JSON.stringify(pickProps(initial)) === JSON.stringify(pickProps(current));
    }

    resetMethodologySector() {
        this.dataService.committeSupportWrapper.methodologySector = this.primaryMethodologyService.getDefaultSector(true,this.dataService.committeSupportWrapper.ratingGroupTemplate,RatingsTableMode.NewRecommendation);
    }

    navToHome() {
        this.updateModel();
    }

    onPrimaryMethodologyChange() {
        this.committeMemoQuestion?.updateExoticOrBespokeConsidered();
        this.committeMemoQuestion?.updateCreditModelQuestionDisplay();
    }

    get documentType() {
        return RatingTemplate;
    }

    get displayRetrieveCurrentRating() {
        const template = this.dataService.getSelectedRatingGroup();
        const ratingGroupsToAvoid: RatingGroupType[] = [RatingGroupType.NonBanking];
        return !ratingGroupsToAvoid.includes(template);
    }

    public checkAllRequiredFieldValidationsPass(): boolean {
        return (
            this.committeMemoQuestion?.isAllRequiredInputValid &&
            this.committeSetupProperties?.isAllRequiredInputValid &&
            this.validateMethodologySectionBasedOnFeatureFlag() &&
            this.esgConsideration?.isValidatedEsgFields &&
            this.validateSovRatingGroup() &&
            this.validateCRQT() &&
            this.validateExoticOrBespokeConsidered() &&
            this.validateCrsCmsVerfied()
        );
    }

    public validateCrsCmsVerfied(): boolean {
        return !(
            this.dataService.committeSupportWrapper.committeeMemoSetup.leadAnalystVerifiedCRQT === 'NO'
        );
    }

    private validateExoticOrBespokeConsidered() {
        if (
            this.committeeInfo.exoticOrBespokeConsidered === YesNoUnknown.Yes &&
            this.committeeInfo.mrgApproved !== YesNoUnknown.Yes
        ) {
            return false;
        }
        return true;
    }
    validateCRQT() {
        if (
            this.isRatingCommitteeWorkflow
        ) {
            if (this.committeeInfo.crqtDeterminedProposedCreditRating === YesNoUnknown.Yes) {
                return !!this.committeeInfo.leadAnalystVerifiedCRQT && !!this.committeeInfo.referenceOnlyCRQT;
            } else if (this.committeeInfo.crqtDeterminedProposedCreditRating === YesNoUnknown.No) {
                return true;
            }

            return false;
        } else {
            return true;
        }
    }

    private validateSovRatingGroup(): boolean {
        return (
            (this.isSovTemplateGroup() &&
                this.committeeInfo.exoticOrBespokeConsidered === YesNoUnknown.Yes &&
                this.committeeInfo.mrgApproved === YesNoUnknown.Yes) ||
            (this.isSovTemplateGroup() &&
                this.committeeInfo.exoticOrBespokeConsidered === YesNoUnknown.No &&
                this.committeeInfo.mrgApproved === YesNoUnknown.Unknown) ||
            !this.isSovTemplateGroup() ||
            this.committeeSupportWrapper.methodologies.length > 0
        );
    }

    private validateMethodologySectionBasedOnFeatureFlag(): boolean {
        return this.showMethodologyRedesignedComponent
            ? this.methodologySectionIsValid
            : this.methodologyService.checkSelectedMethodologyQuestionPass();
    }

    private isFIGTemplateGroup() {
        const figTemplateGroup: RatingGroupType[] = [
            RatingGroupType.BankingFinanceSecurities,
            RatingGroupType.NonBanking,
            RatingGroupType.Insurance
        ];
        this.isFIGTemplateSelected = figTemplateGroup.includes(this.committeeSupportWrapper.ratingGroupTemplate);
    }

    private isSovTemplateGroup() {
        return (
            this.isSovRatingCommitteeWorkflow || this.isSubSovRatingCommitteeWorkflow || this.isSovMdbRatingCommitteeWorkflow
        );
    }

    initateDocumentGenerationProcess() {
        this.updateModel();
        this.generationService.generateArfRcmDocument(this.dataService.selectedTemplateType);
    }
    //NOTE: Remove when generate_at_end_of_flow flag retires
    initateRCMGenerationProcess() {
        this.updateModel();
        this.generationService.generateArfRcmDocument(RatingTemplate.Rcm);
    }

    updateModel() {
        this.esgConsideration?.updateModel();
        this.debtInformationComponent?.updateModel();
    }

    get splitTreatments() {
        return SplitTreatments;
    }

    showEntityShareHolderSection(): boolean {
        return this.dataService.getSelectedRatingGroup() == RatingGroupType.SovereignMDB;
    }

    showReviewSection(): boolean {
        const avoidReviewSection = [
            RatingGroupType.SubSovereign,
            RatingGroupType.SovereignBond,
            RatingGroupType.SovereignMDB,
            RatingGroupType.CFG,
            RatingGroupType.InfrastructureProjectFinance
        ];
        return !avoidReviewSection.includes(this.dataService.getSelectedRatingGroup());
    }

    onClickDownload() {
        if (!this.isFIGTemplateSelected && !this.flagRatingRecommendationTable) {
            if (!this.showNewApproachOnNavBar) {
                this.initateRCMGenerationProcess();
            } else {
                this.initateDocumentGenerationProcess();
            }
        }
        this.hasUnsavedChanges = false;
    }

    /*TODO GROUP INTO A UTILITY CLASS*/
    setNavButtonMetadata() {
        this.buttonMetadata = {
            nextButton: {
                buttonLabel: this.isFIGTemplateSelected ? 'navigationControl.continueLabel' : this.generateBackLabel(),
                buttonId: this.isFIGTemplateSelected ? 'continueToComponentSelectionBtn' : this.generateId()
            },
            prevButton: {
                buttonLabel: 'navigationControl.backLabel',
                buttonId: 'backToArfPageBtn'
            }
        };
    }

    generateBackLabel(): string {
        return this.showNewApproachOnNavBar
            ? 'navigationControl.download'
            : 'navigationControl.generateRatingCommittee';
    }

    generateId(): string {
        return this.showNewApproachOnNavBar ? this.generateButtonId() : 'generateCommitteeMemoBtn';
    }

    generateButtonId(): string {
        return this.dataService.selectedTemplateType === this.documentType.Rcm
            ? 'generateCommitteeMemoBtn'
            : 'generateArfRcmBtn';
    }
}

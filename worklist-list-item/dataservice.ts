import { Injectable, Renderer2 } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { take } from 'rxjs/operators';
import { ActionSetupRatingComitteeQuestionaire } from '../models/ActionSetupRatingComitteeQuestionaire';
import { CommitteeMemo } from '../models/CommittteeMemo';
import { RatingGroupType } from '../models/RatingGroupType';
import { RegulatoryDisclosures } from '../models/RegulatoryDisclosures';
import { FileAccessService } from './repos/file-access-service';
import {
    JurisdictionDetail,
    LatamContractingEntity,
    RatingUnit,
    RegionJurisdiction
} from '../models/regionJurisdictionDetails';
import { CommitteeSupport } from '../models/CommitteeSupport';
import { FilesSupportService } from './repos/files-support.service';
import { ContentLoaderService } from './content-loader.service';
import { YesNoUnknown } from '../models/YesNoUnknown';
import { IssuanceType } from '../models/IssuanceType';
import { IssuingEntityOptions } from '../models/IssuingEntityOptions';
import { Methodology } from '../models/Methodology';
import { HttpResponse } from '@angular/common/http';
import { Entity } from '../models/Entity';
import { DebtInformationType } from '../models/DebtInfomation';
import { RatingTemplateAttributes, RcmCreditModelQuestionRules } from '../models/RCMCreditModelQuestionRules';
import { ComponentSelectionRules, SubcomponentAttributes } from '../models/ComponentSelectionRules';
import { PurposeOfActionType } from '../models/PurposeOfActionType';
import { AccuRateInformationType } from '../models/AccuRateInformationType';
import { WithdrawalReasonType } from '../models/WithdrawalReasonType';
import { InitialQuestionRules } from '../models/InitialQuestionRules';
import { NotificationsService } from 'src/app/core/services/notifications.service';
import { PRDisclosure } from '../models/PRDisclosure';
import { ESGFactors } from '../models/ESGFactors';
import { ReviewDirections } from '../models/ReviewDirections';
import { RatingTemplate } from '../models/RatingTemplate';
import { SfgRegulatoryDisclosures } from '../models/SfgRegulatoryDisclosures';
import { JapanesePRDisclosure } from '../models/JapanesePRDisclosure';
import { LocalizedDatePipe } from 'src/app/shared/pipes/localized-date.pipe';
import { JapaneseConsideration } from '../models/JapaneseConsideration';
import {
    Characteristics,
    LossTriggers,
    NotesIssued,
    PostReviewType,
    ProductLines,
    ProgramTypes,
    SectionAbcp,
    SectionABS,
    SectionRMBS,
    StructuredNotes,
    Tranche,
    VisableComponents
} from '../models';
import { YesNoNotApplicable } from '../models/YesNoNotApplicable';
import {
    SmartDefaultsResponseType,
    SmartDefaultsService
} from '../../features/sov-smart-default-popup/smart-defaults.service';
import { CaseStatus } from './cases';
import { UserProfile } from '../models/UserProfile';
import { SurveillanceReport } from '../models/SurveillanceReports';
import { RatingSyncDirection } from '../models/RatingSyncDirection';
import { OfferingTypeEnum } from '../models/OfferingType';

@Injectable({
    providedIn: 'root'
})
export class DataService {
    public committeSupportWrapper: CommitteeSupport;
    public initialQuestionObject: InitialQuestionRules[];
    public rcmCreditModelQuestionRulesMap: Map<string, Map<string, RatingTemplateAttributes>>;
    public visableComponents: VisableComponents = {
        operating: [],
        financialProfile: [],
        businessProfile: [],
        otherQualitativeConsiderations: [],
        thirdPartySupport: [],
        capitalStructureLossSeverityGivenDefaultNotching: [],
        ratingSpecificConsiderations: []
    };

    // data persistence for Action Setup Page

    public primaryMethodologySector = '';
    public primaryMethodology: string[] = [];

    public ratingGroupTypeSubject: BehaviorSubject<RatingGroupType>;
    public ratingGroupType$: Observable<RatingGroupType>;

    public isSelectedOrgAnalystSame = false;
    public isSelectedOrgParentSame = false;

    public userProfiles = new Map<string, UserProfile>();

    private selectedTemplate: RatingTemplate;

    public hasSelectedTemplate = false;
    public isExistingCase = false;
    public createNewFromExisting = false;

    private jurisdictionSubject = new BehaviorSubject<JurisdictionDetail | undefined>(undefined);
    jurisdiction$ = this.jurisdictionSubject.asObservable();
    componentSelectionRules$;

    constructor(
        private fileAccessService: FileAccessService,
        private filesSupportService: FilesSupportService,
        private contentLoaderService: ContentLoaderService,
        private notificationService: NotificationsService,
        private datePipe: LocalizedDatePipe,
        public smartDefaultService: SmartDefaultsService
    ) {
        this.committeSupportWrapper = new CommitteeSupport();
        this.initialQuestionObject = [];
        this.rcmCreditModelQuestionRulesMap = new Map();

        this.committeSupportWrapper.committeeMemoSetup = new CommitteeMemo();

        this.ratingGroupTypeSubject = new BehaviorSubject(null);
        this.ratingGroupType$ = this.ratingGroupTypeSubject.asObservable();

        this.componentSelectionRules$ = this.fileAccessService.getComponentSelectionRules();
    }

    public getInitialQuestionsRules() {
        this.fileAccessService
            .getInitialQuestionsRules()
            .pipe(take(1))
            .subscribe((data) => {
                this.initialQuestionObject = data;
            });
    }

    public getRcmCreditModelQuestionsRules() {
        this.fileAccessService
            .getRcmCreditModelQuestionRules()
            .pipe(take(1))
            .subscribe((data) => {
                this.mapRcmCreditModelRules(data);
            });
    }

    public getComponentSelection() {
        this.fileAccessService
            .getComponentSelectionRules()
            .pipe(take(1))
            .subscribe((data) => this.mapComponentSelection(data));
    }

    mapComponentSelection(data: ComponentSelectionRules[]) {
        data.forEach((component) => this.mapSubcomponentSelection(component));
    }

    mapSubcomponentSelection(component: ComponentSelectionRules) {
        let subMap: SubcomponentAttributes[] = [];
        Object.entries(component.ratingGroupSelection).forEach(([key, value]) => {
            if (key === this.committeSupportWrapper.ratingGroupTemplate) {
                value.forEach((element) => {
                    if (this.isExistingCase) {
                        element.defaultValue =
                            this.committeSupportWrapper.componentSelection.components[
                                component.componentName + 'SubComponents'
                            ][element.subcomponentName];
                    } else {
                        this.committeSupportWrapper.componentSelection.components[
                            component.componentName + 'SubComponents'
                        ][element.subcomponentName] = element.defaultValue;
                    }
                });
                subMap = value;
            }
        });
        this.visableComponents[component.componentName] = subMap;
    }

    mapRcmCreditModelRules(data: RcmCreditModelQuestionRules[]) {
        data.forEach((creditModelQuestionRule) =>
            this.rcmCreditModelQuestionRulesMap.set(
                creditModelQuestionRule.questionId,
                this.mapRatingGroupTemplates(creditModelQuestionRule.ratingGroupTemplates)
            )
        );
    }

    mapRatingGroupTemplates(
        ratingGroupTemplates: Map<string, RatingTemplateAttributes>
    ): Map<string, RatingTemplateAttributes> {
        const rgtMap: Map<string, RatingTemplateAttributes> = new Map();
        Object.entries(ratingGroupTemplates).forEach(([key, value]) => {
            rgtMap.set(key, new RatingTemplateAttributes(value.methodologyRequired, value.applicableMethodologies));
        });

        return rgtMap;
    }

    public getVisableComponents() {
        return this.visableComponents;
    }

    public updateVisableComponents(componentSelections: string, subComponents: SubcomponentAttributes) {
        this.committeSupportWrapper.componentSelection.components[componentSelections + 'SubComponents'][
            subComponents.subcomponentName
        ] = subComponents.defaultValue;
    }

    public updateNumberOfSelectionsChanged(numberOfSelections: number) {
        this.committeSupportWrapper.componentSelection.numberOfSelections = numberOfSelections;
    }

    public getSfgRegulatoryDisclosure() {
        return this.committeSupportWrapper.sfgRegulatoryDisclosures || new SfgRegulatoryDisclosures();
    }

    public updateSfgRegulatoryDisclosure(updatedSfgRegulatoryDisclosure: SfgRegulatoryDisclosures) {
        if (
            updatedSfgRegulatoryDisclosure.dueDiligence.thirdPartyAssessments ==
            (YesNoUnknown.No || YesNoUnknown.Unknown)
        ) {
            updatedSfgRegulatoryDisclosure.dueDiligence.thirdPartyAssessmentsCount = null;
        }
        this.committeSupportWrapper.sfgRegulatoryDisclosures = updatedSfgRegulatoryDisclosure;
    }

    public updateJapaneseDisclosure(selectedOption: JapanesePRDisclosure) {
        this.committeSupportWrapper.japanesePrDisclosure = selectedOption;
    }

    public get japaneseConsiderationDetails(): JapaneseConsideration {
        return this.committeSupportWrapper.japaneseConsideration;
    }

    public updateJapaneseConsiderationDetails(japaneseConsideration: JapaneseConsideration) {
        this.committeSupportWrapper.japaneseConsideration = japaneseConsideration;
    }

    public getSelectedRatingGroup() {
        return this.committeSupportWrapper.ratingGroupTemplate;
    }

    public getShareHoldersReviewed() {
        return this.committeSupportWrapper.committeeMemoSetup.shareholdersReviewed;
    }

    public getShareHoldersAnalysisIncluded() {
        return this.committeSupportWrapper.committeeMemoSetup.shareholdersAnalysisIncluded;
    }

    public getSelectedRatingTemplate() {
        if (this.committeSupportWrapper.actionRequestForm && this.committeSupportWrapper.ratingCommitteeMemo)
            return RatingTemplate.ArfRcm;
        else if (this.committeSupportWrapper.actionRequestForm) return RatingTemplate.Arf;
        else if (this.committeSupportWrapper.ratingCommitteeMemo) return RatingTemplate.Rcm;
    }

    public getSelectedMethodologies(): Methodology[] {
        return this.committeSupportWrapper?.methodologies || [];
    }

    public getSelectedQuestionnaire() {
        return this.committeSupportWrapper.initialQuestions;
    }

    public getRegulatoryDisclosures() {
        return this.committeSupportWrapper.regulatoryDisclosures;
    }

    public getRegionJurisdiction() {
        return this.committeSupportWrapper.region;
    }

    public getThirdPartyDebtsInformation() {
        return this.committeSupportWrapper.includeThirdPartyDebtRatings;
    }

    public clearThirdPartyDebtsInformation() {
        this.committeSupportWrapper.includeThirdPartyDebtRatings = undefined;
    }

    public getSelectedEntities(): Entity[] {
        return this.committeSupportWrapper.entities;
    }

    public getKeyFromEnum(value: any, enumObj: any) {
        return Object.keys(enumObj).filter((k) => enumObj[k] == value)[0];
    }

    public getKeysFromEnum(values: any, enumObj: any) {
        return Object.keys(enumObj).filter((k) => values.includes(enumObj[k]));
    }

    public getSelectedObjectsFromEnum(values: any, enumObj: any) {
        return enumObj.filter((k) => values.includes(k.value));
    }

    public getPRDisclosure(): PRDisclosure {
        return this.committeSupportWrapper.pressReleaseDisclosures;
    }

    public getRatingCommitteeDate(): Date {
        const dateStr = this.committeSupportWrapper.ratingCommitteeInfo.expected;
        if (dateStr) {
            return this.convertStringToDate(dateStr);
        }
    }

    public getClosingDate(): Date {
        const dateStr = this.committeSupportWrapper.ratingCommitteeInfo.closingDate;
        if (dateStr) {
            return this.convertStringToDate(dateStr);
        }
    }

    public getSurveillanceReport(): SurveillanceReport {
        return this.committeSupportWrapper.regulatoryDisclosures.surveillanceReport;
    }

    public setRatingCommitteeDate(date: Date, format: string) {
        this.committeSupportWrapper.ratingCommitteeInfo.expected = this.convertDateToString(date, format);
    }

    public setClosingDate(date: Date, format: string) {
        this.committeSupportWrapper.ratingCommitteeInfo.closingDate = this.convertDateToString(date, format);
    }

    public convertStringToDate(dateStr: string): Date {
        if (!dateStr) return;
        dateStr = dateStr.replace(/-/g, '/'); // converting mm-dd-yyyy => mm/dd/yyyy due to js date parsing inconsistencies
        return new Date(dateStr);
    }

    public convertDateToString(date: Date, format: string) {
        return date ? this.datePipe.transform(date.toString(), format) : undefined;
    }

    public setPeriodicReview(preiodicReview: YesNoUnknown) {
        this.committeSupportWrapper.regulatoryDisclosures.surveillanceReport.periodicReview = preiodicReview;
    }

    public clearRegulatoryDisclosuresData() {
        this.committeSupportWrapper.regulatoryDisclosures = new RegulatoryDisclosures();
    }

    public clearSFGRegulatoryDisclosuresData() {
        const temp = this.committeSupportWrapper.sfgRegulatoryDisclosures;

        this.committeSupportWrapper.sfgRegulatoryDisclosures = new SfgRegulatoryDisclosures();
        this.committeSupportWrapper.sfgRegulatoryDisclosures.stressScenario = temp.stressScenario;
    }

    public clearHomePageData() {
        this.committeSupportWrapper = new CommitteeSupport();
    }

    public clearSmartDefault() {
        this.smartDefaultService.resetIsUsingSmartDefault();
    }

    resetCommitteeSupportTotNewProcessFlow(): void {
        this.clearSmartDefault();
        this.isExistingCase = false;
    }

    setSmartDefaultState(isUsingSmartDefault: boolean): void {
        const userAccepted = isUsingSmartDefault ? SmartDefaultsResponseType.Yes : SmartDefaultsResponseType.No;
        this.smartDefaultService.setIsUsingSmartDefault(userAccepted);
    }

    // clear /action-setup-properties
    public clearActionSetupPage() {
        this.clearInitialQuestions();
        this.primaryMethodologySector = '';
        this.primaryMethodology = [];
    }

    public clearInitialQuestions() {
        this.committeSupportWrapper.initialQuestions = new ActionSetupRatingComitteeQuestionaire();
    }

    public clearCommitteeSetupPage() {
        this.committeSupportWrapper.committeeMemoSetup = new CommitteeMemo();
        this.clearMethodologyQuestions();
    }

    public updateInitialQuestions(questionnaire: ActionSetupRatingComitteeQuestionaire) {
        this.committeSupportWrapper.initialQuestions = questionnaire;
    }

    public clearMethodologyQuestions() {
        this.committeSupportWrapper.moreInfoInPressRelease = undefined;
        this.committeSupportWrapper.translationToArabic = undefined;
    }

    public populateDisclosureQuestionnaire(questionField: string, chosenValue: any) {
        this.committeSupportWrapper.pressReleaseDisclosures[questionField] = chosenValue;
    }

    public clearDisclosureQuestionnaire() {
        this.committeSupportWrapper.pressReleaseDisclosures = new PRDisclosure();
    }

    public emitLoaderSubject(content?: string) {
        console.log(content);
        this.contentLoaderService.show();
    }
    public generateARFDocument(): Observable<HttpResponse<ArrayBuffer>> {
        return this.filesSupportService.generateARFDocument(this.committeSupportWrapper);
    }

    public generateRCMDocument(): Observable<HttpResponse<ArrayBuffer>> {
        return this.filesSupportService.generateRCMDocument(this.committeSupportWrapper);
    }

    //clear data from home page (rating group and rating group template)
    public clearSelectedTemplatesFromHomePage() {
        this.ratingGroupTypeSubject.next(null);
    }

    public updateRatingGroupSelection(ratingGroup: RatingGroupType) {
        this.committeSupportWrapper.ratingGroupTemplate = ratingGroup;
        this.ratingGroupTypeSubject.next(ratingGroup);
    }

    public get selectedTemplateType(): RatingTemplate {
        return this.selectedTemplate;
    }

    public set selectedTemplateType(param: RatingTemplate) {
        this.selectedTemplate = param;
    }

    public updateShareHoldersReviewed(shareholdersReviewed: YesNoNotApplicable) {
        this.committeSupportWrapper.committeeMemoSetup.shareholdersReviewed = shareholdersReviewed;
    }

    public updateShareHoldersAnalysisIncluded(shareholdersAnalysisIncluded: YesNoNotApplicable) {
        this.committeSupportWrapper.committeeMemoSetup.shareholdersAnalysisIncluded = shareholdersAnalysisIncluded;
    }

    public updateRMBS(sectionRMBS: SectionRMBS) {
        this.committeSupportWrapper.entities[0].mbsExpectedLoss = Number(sectionRMBS.expectedLoss);
        this.committeSupportWrapper.entities[0].mbsMilanModelCE = Number(sectionRMBS.milanCE);
    }

    public updateABS(sectionABS: SectionABS) {
        this.committeSupportWrapper.entities[0].absExpectedLoss = Number(sectionABS.expectedLoss);
        this.committeSupportWrapper.entities[0].absAaaLevelPercentage = Number(sectionABS.moodysAAALevel);
    }

    setSelectedJurisdiction(): void {
        this.jurisdictionSubject.next(this.committeSupportWrapper.region);
    }

    public updateRatingTemplateSelection(selectedTemplate: RatingTemplate) {
        this.selectedTemplate = selectedTemplate;

        if (selectedTemplate === RatingTemplate.ArfRcm) {
            this.committeSupportWrapper.actionRequestForm = true;
            this.committeSupportWrapper.ratingCommitteeMemo = true;
        } else if (selectedTemplate === RatingTemplate.Arf) {
            this.committeSupportWrapper.actionRequestForm = true;
            this.committeSupportWrapper.ratingCommitteeMemo = false;
        } else if (selectedTemplate === RatingTemplate.Rcm) {
            this.committeSupportWrapper.actionRequestForm = false;
            this.committeSupportWrapper.ratingCommitteeMemo = true;
        }
    }

    public updateESGConsideration(isESGRecommended: YesNoUnknown, esgFactors: Set<ESGFactors>) {
        const prDisclosure = this.committeSupportWrapper.pressReleaseDisclosures;
        prDisclosure.esgFactorsKeyDrivers = isESGRecommended;

        if (esgFactors) {
            prDisclosure.relevantESGFactors = [...esgFactors];
        }
    }

    public updateMethodologySelection(methodologies: Methodology[]) {
        this.committeSupportWrapper.methodologies = methodologies;
        if (methodologies.length === 0) {
            this.clearMethodologyQuestions();
        }
    }

    public updateMethodologySectorSelection(selectedSector: string) {
        this.committeSupportWrapper.methodologySector = selectedSector;
    }

    public updatePurposeOfActions(selectedPurposeOfAction: string[]) {
        this.committeSupportWrapper.pressReleaseDisclosures.purposesOfAction = selectedPurposeOfAction?.map(
            (purposeOfAction) => PurposeOfActionType[purposeOfAction]
        );
    }

    public clearPurposeOfActions() {
        this.committeSupportWrapper.pressReleaseDisclosures.purposesOfAction = undefined;
    }

    public updateAccurateInformation(accurateInformations: string[]) {
        this.committeSupportWrapper.pressReleaseDisclosures.accuRateInformations = accurateInformations?.map(
            (accuRateInformation) => AccuRateInformationType[accuRateInformation]
        );
    }

    public updateWithDrawlReasons(withdrawlReasons: string[]) {
        this.committeSupportWrapper.pressReleaseDisclosures.withdrawalReasons = withdrawlReasons?.map(
            (withdrawlReason) => WithdrawalReasonType[withdrawlReason]
        );
    }

    /*TODO CODE_DEBT
     * FEATURE IS DEPRECATED
     * */
    public updateThirdPartyDebt(includeThirdPartyDebtRatings: boolean) {
        this.committeSupportWrapper.includeThirdPartyDebtRatings = includeThirdPartyDebtRatings;
    }

    public updateDebtInformation(debtInformation: DebtInformationType) {
        this.committeSupportWrapper.includeDebts = debtInformation == DebtInformationType.instrument;
    }

    public updateTranslationToArabic(option: YesNoUnknown) {
        this.committeSupportWrapper.translationToArabic = option;
    }

    public updateGlobalSelection() {
        const jurisdictionDetail: JurisdictionDetail = new JurisdictionDetail();
        jurisdictionDetail.name = RegionJurisdiction.Global;
        jurisdictionDetail.jurisdiction = RatingUnit.Global;

        this.committeSupportWrapper.region = jurisdictionDetail;
    }

    public updateLatinAmericaSelection(
        issuanceType: IssuanceType,
        contractingEntity: LatamContractingEntity,
        issuingEntity: IssuingEntityOptions
    ) {
        const jurisdictinDetail: JurisdictionDetail = new JurisdictionDetail();
        jurisdictinDetail.name = RegionJurisdiction.LatinAmerica;
        jurisdictinDetail.issuanceType = issuanceType;

        if (issuanceType === IssuanceType.CrossBorderRatings) {
            jurisdictinDetail.jurisdiction = RatingUnit.Global;
            jurisdictinDetail.contractingEntity = LatamContractingEntity.CrossBorder;
            jurisdictinDetail.issuingEntity = IssuingEntityOptions.MooysCrossBorder;
        } else {
            jurisdictinDetail.contractingEntity = contractingEntity;
            jurisdictinDetail.issuingEntity = issuingEntity;

            switch (contractingEntity) {
                case LatamContractingEntity.Argentina:
                    jurisdictinDetail.jurisdiction = RatingUnit.Global;
                    break;
                case LatamContractingEntity.Brazil:
                    jurisdictinDetail.jurisdiction = RatingUnit.Mal;
                    break;
                case LatamContractingEntity.Mexico:
                    jurisdictinDetail.jurisdiction = RatingUnit.Mdm;
                    break;
                default:
                    console.error('Incorrect Contracting Entity Received.');
            }
        }

        this.committeSupportWrapper.region = jurisdictinDetail;
    }

    public updateJapanSelection(ratingEntity: RatingUnit) {
        const jurisdictinDetail: JurisdictionDetail = new JurisdictionDetail();
        jurisdictinDetail.name = RegionJurisdiction.Japan;
        jurisdictinDetail.jurisdiction = ratingEntity;

        this.committeSupportWrapper.region = jurisdictinDetail;
    }

    public cancelJuristictionSelection() {
        const jurisdictinDetail: JurisdictionDetail = new JurisdictionDetail();
        jurisdictinDetail.name = RegionJurisdiction.Global;
        jurisdictinDetail.jurisdiction = RatingUnit.Global;
        this.committeSupportWrapper.region = jurisdictinDetail;
    }

    public updateSelectedEntities(selectedEntities: Entity[]) {
        /* ensures previous data is retained*/
        const selectedEntityState = selectedEntities.map((currentEntity) => {
            const existingEntity = this.committeSupportWrapper.entities.find(
                (entity) => entity.id === currentEntity.id
            );
            if (existingEntity) {
                return {
                    ...existingEntity,
                    ...currentEntity
                };
            }
            return currentEntity;
        });

        this.committeSupportWrapper.entities = [...selectedEntityState];
        this.committeSupportWrapper.entitiesFromSameFamily = this.isSelectedOrgParentSame;
    }

    public onBlurEventListener(multiselectReference: any, renderer: Renderer2) {
        const filteredOptions: any = multiselectReference.filteredOptions;
        if (multiselectReference?._input?.nativeElement === undefined) return;
        renderer.listen(multiselectReference?._input?.nativeElement, 'blur', () => {
            multiselectReference._input.nativeElement.value = '';
            multiselectReference.filteredOptions = filteredOptions;
        });
    }

    public showArfButton() {
        return this.committeSupportWrapper.actionRequestForm;
    }

    public prepareRcmOutageRequest() {
        this.committeSupportWrapper.actionRequestForm = false;
        this.committeSupportWrapper.ratingCommitteeMemo = true;
        // default all subcomponents to true
        Object.entries(this.committeSupportWrapper.componentSelection.components).forEach(([, section]) =>
            Object.entries(section).forEach(([a]) => (section[a] = true))
        );
    }

    public prepareArfOutageRequest() {
        this.committeSupportWrapper.actionRequestForm = true;
        this.committeSupportWrapper.ratingCommitteeMemo = false;
    }

    public toggleHasSelectedTemplate() {
        this.hasSelectedTemplate = !this.hasSelectedTemplate;
    }

    /*
     * Manages values from the asset specific fields
     * @params assetSpecificFields
     * todo switch to individual model update
     *  */
    updateTranches(tranches: Tranche[]): void {
        const entities = this.committeSupportWrapper.entities[0];
        this.setTranches(entities, tranches);
    }

    updateSelectedEntitiesOfferingType(offeringTypes: OfferingTypeEnum[]) {
        this.committeSupportWrapper.entities[0].offeringTypes = [...offeringTypes];
    }
    updateSelectedEntitiesCustomOfferingType(customOfferingType: string) {
        this.committeSupportWrapper.entities[0].otherOfferingType = customOfferingType;
    }

    updateStructuredNotes(structuredNotes: StructuredNotes): void {
        const [selectedEntity] = this.committeSupportWrapper.entities;
        this.committeSupportWrapper.entities[0] = { ...selectedEntity, ...structuredNotes };
    }

    updateCatBonds(lossTriggerType: LossTriggers) {
        this.committeSupportWrapper.entities[0].lossTriggerType = lossTriggerType;
    }

    setSectionAbcp(sectionAbcp: SectionAbcp) {
        const entities = this.committeSupportWrapper.entities[0];
        const productLineKey = Object.keys(ProductLines).find((x) => ProductLines[x] == sectionAbcp?.productLine[0]);
        entities.productLineType = ProductLines[productLineKey];

        const programTypeKey = Object.keys(ProgramTypes).find((x) => ProgramTypes[x] == sectionAbcp?.program[0]);
        entities.programType = ProgramTypes[programTypeKey];

        const characteristicsKey = Object.keys(Characteristics).find(
            (x) => Characteristics[x] == sectionAbcp?.characteristics[0]
        );
        entities.characteristicType = Characteristics[characteristicsKey];

        const notesTypeKey = Object.keys(NotesIssued).find((x) => NotesIssued[x] == sectionAbcp?.notesIssued);
        entities.notesType = NotesIssued[notesTypeKey];

        if (sectionAbcp?.mtns) {
            entities.mtns = true;
        } else if (sectionAbcp?.mtns === false) {
            entities.mtns = false;
        }

        const postReviewKey = Object.keys(PostReviewType).find((x) => PostReviewType[x] == sectionAbcp?.postReview);

        entities.reviewType = PostReviewType[postReviewKey];

        entities.matchFunding = sectionAbcp?.matchFunding;
    }

    private setTranches(entities: Entity, tranches: Tranche[]) {
        entities.tranches = tranches;
    }

    /*
     * Manages the user selected Review Questions
     * @params selectedReviewDirections[]
     *  */
    onChangeRegulatoryDisclosure(selectedReviewDirections: ReviewDirections[]): void {
        this.committeSupportWrapper.regulatoryDisclosures.reasonForReviewAction = [...selectedReviewDirections];
    }

    /*Manage Creating CASES OPERATION*/
    manageCaseDetails(caseStatus: CaseStatus, name: string): Observable<CommitteeSupport> {
        if (!this.committeSupportWrapper.caseNameOverWritten) {
            this.committeSupportWrapper.createName(name);
        }
        if (caseStatus) {
            this.setCaseStatus(caseStatus);
        }

        return of(this.committeSupportWrapper);
    }

    setCaseId(id) {
        this.committeSupportWrapper.setId(id);
    }

    private setCaseStatus(status: CaseStatus) {
        this.committeSupportWrapper.status = status;
    }

    public getUserProfiles(): Map<string, UserProfile> {
        return this.userProfiles;
    }

    public updateRatingSyncDirection(ratingSyncDirection: RatingSyncDirection) {
        this.committeSupportWrapper.ratingSyncDirection = ratingSyncDirection;
    }

    public generateCaseId(): string {
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

        if (this.getUserProfiles().size > 0) {
            caseId = this.getUserProfiles().keys().next().value.toUpperCase() + '-' + dateTimeSecs;
        }
        return caseId;
    }
}

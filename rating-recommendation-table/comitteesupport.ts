import { ActionSetupRatingComitteeQuestionaire } from './ActionSetupRatingComitteeQuestionaire';
import { CommitteeMemo } from './CommittteeMemo';
import { ComponentSelection } from './ComponentSelection';
import { Entity } from './Entity';
import { Methodology } from './Methodology';
import { PRDisclosure } from './PRDisclosure';
import { RatingGroupType } from './RatingGroupType';
import { JurisdictionDetail } from './regionJurisdictionDetails';
import { RegulatoryDisclosures } from './RegulatoryDisclosures';
import { YesNoUnknown } from './YesNoUnknown';
import { SfgRegulatoryDisclosures } from './SfgRegulatoryDisclosures';
import { JapanesePRDisclosure } from './JapanesePRDisclosure';
import { JapaneseConsideration } from './JapaneseConsideration';
import { AssetSpecificFields } from './AssetSpecificFields';
import { CaseStatus } from '../services/cases';
import { CaseData } from '../types/case-data';
import { RatingSyncDirection } from './RatingSyncDirection';
import { RFCImpactType } from '../../features/primary-methodology-enhanced/interfaces/rfc.interface';
import { Participant } from '../types/participant';
import { CommitteeConfirmationData } from '@app/vote/repository/types/committee-confirmation-data';
import { ActionDetails } from '@app/participants/models/actionDetails';
import { Publications } from '@app/participants/models/publications';
import { deepCopy } from '@angular-devkit/core/src/utils/object';
const ratingGroupTypeEnumKeys = Object.keys(RatingGroupType);

export class CommitteeSupport {
    ratingGroupTemplate: RatingGroupType;
    id: string;
    caseId: string;
    name: string;
    status: CaseStatus;
    region: JurisdictionDetail;
    actionRequestForm: boolean;
    ratingCommitteeMemo: boolean;
    includeConduits: boolean;
    includeDebts = true;
    includeThirdPartyDebtRatings: boolean;
    moreInfoInPressRelease: YesNoUnknown;
    translationToArabic: YesNoUnknown;
    private unmodifedEntities: Entity[];
    entities: Entity[];
    entitiesFromSameFamily: boolean;
    committeeMemoSetup: CommitteeMemo;
    ratingCommitteeInfo: CommitteeInfo;
    initialQuestions: ActionSetupRatingComitteeQuestionaire;
    assetSpecificFields: AssetSpecificFields;
    componentSelection: ComponentSelection;
    methodologySector: string;
    methodologies: Methodology[];
    rfcImpactType?: RFCImpactType;
    pressReleaseDisclosures: PRDisclosure = new PRDisclosure();
    regulatoryDisclosures: RegulatoryDisclosures = new RegulatoryDisclosures();
    sfgRegulatoryDisclosures: SfgRegulatoryDisclosures = new SfgRegulatoryDisclosures();
    japanesePrDisclosure: JapanesePRDisclosure;
    japaneseConsideration: JapaneseConsideration;
    isOutageMode: boolean;
    caseNameOverWritten: boolean;
    ratingSyncDirection: RatingSyncDirection;
    lastSaveAndDownloadDate: Date;
    teamSetup: Participant[];
    ratingCommittee: RatingCommittee;
    camsId: string;
    actionList: ActionDetails[];
    publications: Publications[];
    isFinalized: boolean;
    numberOfCommittees: number;
    rasEnabled : boolean = false;
    constructor() {
        this.committeeMemoSetup = new CommitteeMemo();
        this.ratingCommitteeInfo = new CommitteeInfo();
        this.region = new JurisdictionDetail();
        this.entities = new Array<Entity>();
        this.unmodifedEntities = new Array<Entity>();
        this.methodologies = new Array<Methodology>();
        this.componentSelection = new ComponentSelection();
        this.isOutageMode = false;
        this.caseNameOverWritten = false;
        this.includeThirdPartyDebtRatings = true;
        this.teamSetup = new Array<Participant>();
        this.ratingCommittee = new RatingCommittee();
        this.rasEnabled = false;
    }

    createName(name: string) {
        this.name =
            name + ' ' + new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
    }

    setId(id: string) {
        this.id = id;
    }

    updateEntities(entities: Entity[]) {
        this.unmodifedEntities = deepCopy(entities);
        this.entities = deepCopy(entities);
    }

    resetEntities() {
        this.entities = deepCopy(this.unmodifedEntities);
    }

    createFromCase(caseData: CaseData): CommitteeSupport {
        this.numberOfCommittees = caseData.numberOfCommittees || 0;
        this.actionRequestForm = caseData.actionRequestForm;
        this.assetSpecificFields = caseData.assetSpecificFields;
        this.committeeMemoSetup = caseData.committeeMemoSetup;
        this.componentSelection = caseData.componentSelection;
        this.entities = deepCopy(caseData.entities);
        this.unmodifedEntities = deepCopy(caseData.entities);
        this.entitiesFromSameFamily = caseData.entitiesFromSameFamily;
        this.id = caseData.id;
        this.caseId = caseData.caseId;
        this.includeConduits = caseData.includeConduits;
        this.includeDebts = caseData.includeDebts;
        this.includeThirdPartyDebtRatings = caseData.includeThirdPartyDebtRatings;
        this.initialQuestions = caseData.initialQuestions;
        this.isOutageMode = caseData.isOutageMode;
        this.japaneseConsideration = caseData.japaneseConsideration;
        this.japanesePrDisclosure = caseData.japanesePrDisclosure;
        this.moreInfoInPressRelease = caseData.moreInfoInPressRelease;
        this.name = caseData.name;
        this.pressReleaseDisclosures = new PRDisclosure(
            caseData.pressReleaseDisclosures,
            caseData.moreInfoInPressRelease,
            caseData.translationToArabic
        );
        this.ratingCommitteeInfo = caseData.ratingCommitteeInfo;
        this.ratingCommitteeMemo = caseData.ratingCommitteeMemo;
        this.ratingGroupTemplate = this.getRatingGroupFromString(caseData.ratingGroupTemplate);
        this.region = caseData.region;
        this.regulatoryDisclosures = caseData.regulatoryDisclosures;
        this.sfgRegulatoryDisclosures = caseData.sfgRegulatoryDisclosures;
        this.status = caseData.status;
        this.translationToArabic = caseData.translationToArabic;
        this.caseNameOverWritten = caseData.caseNameOverWritten;
        this.methodologies = caseData.methodologies || [];
        this.rfcImpactType = caseData.rfcImpactType;
        this.methodologySector = caseData.methodologySector;
        this.lastSaveAndDownloadDate = caseData.lastSaveAndDownloadDate;
        this.teamSetup = caseData.teamSetup;
        this.ratingCommittee = caseData.ratingCommittee;
        this.camsId = caseData.camsId;

        if (this.caseNameOverWritten) {
            this.name = caseData.name;
        }
        this.isFinalized = !!caseData.finalizedDate;

        return this;
    }

    getRatingGroupFromString(ratingGroup: string) {
        return RatingGroupType[ratingGroupTypeEnumKeys.find((type) => RatingGroupType[type] == ratingGroup)];
    }
}

export class CommitteeInfo {
    expected?: string;
    number: number;
    closingDate?: string;
}

export class RatingCommittee {
    preCommittee: CommitteeConfirmationData;
    preVote: CommitteeConfirmationData;
    postCommittee: CommitteeConfirmationData;
    voteTally: string;
    actual?: string;
}

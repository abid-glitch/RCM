import { CommitteeReasonType } from './CommitteeReasonType';
import { YesNoUnknown } from './YesNoUnknown';
import { YesNoNotApplicable } from './YesNoNotApplicable';

export class CommitteeMemo {
    conflictCheckId?: number;
    franchiseCreditInvolved: YesNoUnknown;
    reason: CommitteeReasonType | string;
    keyFactualElements: KeyFactualElement[];
    exoticOrBespokeConsidered: YesNoUnknown;
    genAIUsedInRatingProcess: YesNoUnknown;
    confirmUnderstandingGenAIUsage?: YesNoUnknown;
    mrgApproved: YesNoUnknown;
    lgdModelUsed: YesNoUnknown;
    crsCrmVerified?: YesNoUnknown;
    insuranceScoreUsed: YesNoUnknown;
    insuranceScoreUsedOverIndMethodology: YesNoUnknown;
    shareholdersReviewed: YesNoNotApplicable;
    shareholdersAnalysisIncluded: YesNoNotApplicable;
    ratingCommitteeReasons = [];

    crqtDeterminedProposedCreditRating: YesNoUnknown;

    crqt?: CommitteeMemoCRQT[];
    leadAnalystVerifiedCRQT?: YesNoUnknown;
    referenceOnlyCRQT?: YesNoUnknown;

    constructor() {
        this.exoticOrBespokeConsidered = YesNoUnknown.Unknown;
        this.mrgApproved = YesNoUnknown.Unknown;
    }
}

export class CommitteeMemoCRQT {
    publicationName: string;
    creditRatingScoreCard: boolean;
    model: boolean;
}
export class KeyFactualElement {
    value: string;
    dataSources: string[];
    issuerSources: string[];
    thirdPartySources: string[];
    comments: string;
}

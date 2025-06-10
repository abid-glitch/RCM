import { KeyFactualElementGroup } from './KeyFactualElementGroup';
import { TemplateCategoryType } from './TemplateCategoryType';

export enum RatingGroupType {
    CFG = 'CFG',
    BankingFinanceSecurities = 'BANKING_FINANCE_SECURITY',
    Insurance = 'INSURANCE',
    NonBanking = 'NON_BANKING',
    InfrastructureProjectFinance = 'PIF',
    MSPG = 'MSPG',
    PFG = 'PFG',
    SFGCoveredBonds = 'SFG_COVERED_BONDS',
    SFGPrimary = 'SFG_PRIMARY',
    SFGRACDecisionMemo = 'SFG_RAC_DECISION_MEMO',
    SFGSurveillance = 'SFG_SURVEILLANCE',
    SovereignBond = 'SOVEREIGN_BOND',
    SubSovereign = 'SUB_SOVEREIGN',
    SovereignMDB = 'SOVEREIGN_MDB'
}

export enum LineOfBusiness {
    CORPORATE_FINANCE_GROUP = 'CORPORATE_FINANCE_GROUP',
    STRUCTURED_FINANCE_GROUP = 'STRUCTURED_FINANCE_GROUP',
    FINANCIAL_INSTITUTIONS_GROUP = 'FINANCIAL_INSTITUTIONS_GROUP',
    PUBLIC_PROJECT_INFRASTRUCTURE_FINANCE = 'PUBLIC_PROJECT_INFRASTRUCTURE_FINANCE'
}

export const ratingGroupMapByLOB: Record<RatingGroupType, LineOfBusiness> = {
    [RatingGroupType.CFG]: LineOfBusiness.CORPORATE_FINANCE_GROUP,
    [RatingGroupType.BankingFinanceSecurities]: LineOfBusiness.FINANCIAL_INSTITUTIONS_GROUP,
    [RatingGroupType.Insurance]: LineOfBusiness.FINANCIAL_INSTITUTIONS_GROUP,
    [RatingGroupType.NonBanking]: LineOfBusiness.FINANCIAL_INSTITUTIONS_GROUP,
    [RatingGroupType.InfrastructureProjectFinance]: LineOfBusiness.PUBLIC_PROJECT_INFRASTRUCTURE_FINANCE,
    [RatingGroupType.MSPG]: LineOfBusiness.PUBLIC_PROJECT_INFRASTRUCTURE_FINANCE,
    [RatingGroupType.SubSovereign]: LineOfBusiness.PUBLIC_PROJECT_INFRASTRUCTURE_FINANCE,
    [RatingGroupType.SovereignBond]: LineOfBusiness.PUBLIC_PROJECT_INFRASTRUCTURE_FINANCE,
    [RatingGroupType.SovereignMDB]: LineOfBusiness.PUBLIC_PROJECT_INFRASTRUCTURE_FINANCE,
    [RatingGroupType.PFG]: LineOfBusiness.PUBLIC_PROJECT_INFRASTRUCTURE_FINANCE,
    [RatingGroupType.SFGCoveredBonds]: LineOfBusiness.STRUCTURED_FINANCE_GROUP,
    [RatingGroupType.SFGPrimary]: LineOfBusiness.STRUCTURED_FINANCE_GROUP,
    [RatingGroupType.SFGRACDecisionMemo]: LineOfBusiness.STRUCTURED_FINANCE_GROUP,
    [RatingGroupType.SFGSurveillance]: LineOfBusiness.STRUCTURED_FINANCE_GROUP
};

//TODO: rename const and ENUM
export const templatesToGroupMap: Record<RatingGroupType, TemplateCategoryType> = {
    [RatingGroupType.CFG]: TemplateCategoryType.groupA,
    [RatingGroupType.InfrastructureProjectFinance]: TemplateCategoryType.groupA,
    [RatingGroupType.SFGCoveredBonds]: TemplateCategoryType.groupB,
    [RatingGroupType.SFGPrimary]: TemplateCategoryType.groupB,
    [RatingGroupType.SFGSurveillance]: TemplateCategoryType.groupB,
    [RatingGroupType.BankingFinanceSecurities]: TemplateCategoryType.groupC1,
    [RatingGroupType.Insurance]: TemplateCategoryType.groupC1,
    [RatingGroupType.NonBanking]: TemplateCategoryType.groupC1,
    [RatingGroupType.SubSovereign]: TemplateCategoryType.groupC2,
    [RatingGroupType.SovereignBond]: TemplateCategoryType.groupC3,
    [RatingGroupType.SovereignMDB]: TemplateCategoryType.groupC3,
    [RatingGroupType.MSPG]: TemplateCategoryType.groupD,
    [RatingGroupType.SFGRACDecisionMemo]: TemplateCategoryType.groupD,
    [RatingGroupType.PFG]: TemplateCategoryType.groupD
};

////********************************************************************************************* */
//              Relationship Map between Rating Group and Key Factual Elements
////********************************************************************************************* */

export const keyFactualElementRelationshipMap: Partial<Record<RatingGroupType, KeyFactualElementGroup>> = {
    [RatingGroupType.CFG]: KeyFactualElementGroup.cfg,
    [RatingGroupType.BankingFinanceSecurities]: KeyFactualElementGroup.fig,
    [RatingGroupType.Insurance]: KeyFactualElementGroup.fig,
    [RatingGroupType.NonBanking]: KeyFactualElementGroup.fig,
    [RatingGroupType.InfrastructureProjectFinance]: KeyFactualElementGroup.pif,
    [RatingGroupType.SubSovereign]: KeyFactualElementGroup.subSovereign,
    [RatingGroupType.SovereignBond]: KeyFactualElementGroup.sovereignBond,
    [RatingGroupType.SovereignMDB]: KeyFactualElementGroup.sovereignMDB,
    [RatingGroupType.MSPG]: KeyFactualElementGroup.mspg,
    [RatingGroupType.PFG]: KeyFactualElementGroup.pfg
};

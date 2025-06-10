// /*Manages save current case and download document */
// saveAndDownload(config?: RatingRecommendationSaveAndDownloadConfig): void {
//     this.loading$.next(true);
//     const caseStatus = this.isRatingCommitteeWorkflow ? CaseStatus.Transitioned : CaseStatus.Completed;
//     this.dataService
//         .manageCaseDetails(caseStatus, this.entityService.selectedOrgTobeImpacted[0]?.name)
//         .pipe(
//             first(),
//             tap((committeeSupportWrapper) => {
//                 if (this.isRatingCommitteeWorkflow) {
//                     committeeSupportWrapper.lastSaveAndDownloadDate = new Date(new Date().toISOString());
//                 }
//             }),
//             switchMap(() => this.processUpdateCase(caseStatus)),
//             tap(() => {
//                 this.onClickDownload(config);
//             }),
//             tap(() => {
//                 if (config) {
//                     // Original ARF logic - navigate for all LOBs when only ARF is selected
//                     if (config.actionRequestForm && !config.rcmCoverPage && !config.rcmAnalytical) {
//                         this.resetToHomePage();
//                     }
//                     // For SFG/PPIF LOBs - navigate when modal was used (any document selection)
//                     else if (this.shouldNavigateToWorklistForCurrentRatingGroup()) {
//                         this.resetToHomePage();
//                     }
//                 }
//             }),
//             finalize(() => {
//                 this.enableButton();
//             }),
//             debounceTime(120000)
//         )
//         .subscribe();
// }

// /**
//  * Check if current rating group should navigate to worklist
//  * Uses string matching to avoid import issues
//  */
// private shouldNavigateToWorklistForCurrentRatingGroup(): boolean {
//     const currentRatingGroup = this.dataService.committeSupportWrapper?.ratingGroupTemplate;
    
//     if (!currentRatingGroup) {
//         return false;
//     }
    
//     // SFG rating groups (string values)
//     const sfgGroups = ['SFG_COVERED_BONDS', 'SFG_PRIMARY', 'SFG_RAC_DECISION_MEMO', 'SFG_SURVEILLANCE'];
    
//     // PPIF rating groups (string values)
//     const ppifGroups = ['PIF', 'MSPG', 'SUB_SOVEREIGN', 'SOVEREIGN_BOND', 'SOVEREIGN_MDB', 'PFG'];
    
//     return sfgGroups.includes(currentRatingGroup) || ppifGroups.includes(currentRatingGroup);
// }





/*Manages save current case and download document */
saveAndDownload(config?: RatingRecommendationSaveAndDownloadConfig): void {
    this.loading$.next(true);
    const caseStatus = this.isRatingCommitteeWorkflow ? CaseStatus.Transitioned : CaseStatus.Completed;
    this.dataService
        .manageCaseDetails(caseStatus, this.entityService.selectedOrgTobeImpacted[0]?.name)
        .pipe(
            first(),
            tap((committeeSupportWrapper) => {
                if (this.isRatingCommitteeWorkflow) {
                    committeeSupportWrapper.lastSaveAndDownloadDate = new Date(new Date().toISOString());
                }
            }),
            switchMap(() => this.processUpdateCase(caseStatus)),
            tap(() => {
                this.onClickDownload(config);
            }),
            tap(() => {
                if (config) {
                    // Original ARF logic - navigate for all LOBs when only ARF is selected
                    if (config.actionRequestForm && !config.rcmCoverPage && !config.rcmAnalytical) {
                        this.resetToHomePage();
                    }
                    // Navigate when config exists (modal was shown)
                    else {
                        this.resetToHomePage();
                    }
                }
            }),
            finalize(() => {
                this.enableButton();
            }),
            debounceTime(120000)
        )
        .subscribe();
}

checkIfModalIsApplicableForRatingGroup() {
    const ratingGroup = this.dataService.committeSupportWrapper?.ratingGroupTemplate;
    
    // Original 3 groups that were working
    const originalGroups = [
        RatingGroupType.SFGCoveredBonds,
        RatingGroupType.SFGPrimary, 
        RatingGroupType.NonBanking
    ];
    
    // Additional SFG groups
    const additionalSFGGroups = [
        RatingGroupType.SFGRACDecisionMemo,
        RatingGroupType.SFGSurveillance
    ];
    
    // PPIF groups
    const ppifGroups = [
        RatingGroupType.InfrastructureProjectFinance,
        RatingGroupType.MSPG,
        RatingGroupType.SubSovereign,
        RatingGroupType.SovereignBond,
        RatingGroupType.SovereignMDB,
        RatingGroupType.PFG
    ];
    
    return originalGroups.includes(ratingGroup) || 
           additionalSFGGroups.includes(ratingGroup) || 
           ppifGroups.includes(ratingGroup);
}

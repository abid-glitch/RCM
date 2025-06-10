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
                    // Navigate when modal was shown (config exists means modal was displayed)
                    else {
                        this.resetToHomePage();
                    }
                } else {
                    // Handle PIF case - no modal shown but should navigate to worklist for PIF
                    if (this.shouldNavigateToWorklistWithoutModal()) {
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

// Keep original method unchanged - only for modal display logic
checkIfModalIsApplicableForRatingGroup() {
    return (
        this.dataService.committeSupportWrapper.ratingGroupTemplate === RatingGroupType.SFGCoveredBonds ||
        this.dataService.committeSupportWrapper.ratingGroupTemplate === RatingGroupType.SFGPrimary ||
        this.dataService.committeSupportWrapper.ratingGroupTemplate === RatingGroupType.NonBanking
    );
}

// New method specifically for navigation logic
private shouldNavigateToWorklistWithoutModal(): boolean {
    const ratingGroup = this.dataService.committeSupportWrapper?.ratingGroupTemplate;
    
    // PIF and other PPIF groups that don't show modal but should navigate to worklist
    const ppifGroups = [
        RatingGroupType.InfrastructureProjectFinance, // PIF
        RatingGroupType.MSPG,
        RatingGroupType.SubSovereign,
        RatingGroupType.SovereignBond,
        RatingGroupType.SovereignMDB,
        RatingGroupType.PFG
    ];
    
    return ppifGroups.includes(ratingGroup);
}

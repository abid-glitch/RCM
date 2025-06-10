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
                    // Navigate for SFG and PPIF rating groups when any document is selected
                    else if (this.isSFGOrPPIFLOB()) {
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

/**
 * Check if current rating group belongs to SFG or PPIF LOBs
 */
private isSFGOrPPIFLOB(): boolean {
    const currentRatingGroup = this.dataService.committeSupportWrapper.ratingGroupTemplate;
    
    // SFG rating groups
    const sfgGroups = [
        RatingGroupType.SFGCoveredBonds,
        RatingGroupType.SFGPrimary,
        RatingGroupType.SFGRACDecisionMemo,
        RatingGroupType.SFGSurveillance
    ];
    
    // PPIF rating groups
    const ppifGroups = [
        RatingGroupType.InfrastructureProjectFinance,
        RatingGroupType.MSPG,
        RatingGroupType.SubSovereign,
        RatingGroupType.SovereignBond,
        RatingGroupType.SovereignMDB,
        RatingGroupType.PFG
    ];
    
    return sfgGroups.includes(currentRatingGroup) || ppifGroups.includes(currentRatingGroup);
}

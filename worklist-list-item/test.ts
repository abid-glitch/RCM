private navigateToRatingRecommendationPage() {
    this.contentLoaderService.show();
    
    this.casesService.getCaseById(this.case.id)
        .pipe(
            tap(committeeSupport => {
                // Store case data and process entities
                this.dataService.committeSupportWrapper = committeeSupport;
                this.createCurrentEntityDictionary();
                
                if (committeeSupport.entities?.length) {
                    // Update data service with entities
                    this.dataService.updateSelectedEntities(committeeSupport.entities);
                    
                    // Set table mode for rating recommendation
                    this.ratingRecommendationService.setRatingsTableMode({
                        tableMode: RatingsTableMode.EditRecommendation,
                        ratingsDetails: this.selectedCaseEntityDictionary
                    });
                }
            }),
            // Call committeePackageApiService to sync entity data
            switchMap(() => {
                const committeePackageData = {
                    caseId: this.case.id,
                    ratingCommittee: this.dataService.committeSupportWrapper.ratingCommitteeInfo || {},
                    teamSetups: this.dataService.committeSupportWrapper.teamSetup || {},
                    entityRatings: this.dataService.committeSupportWrapper.entities || [],
                    packageDocuments: this.dataService.committeSupportWrapper.packageDocuments || []
                };
                
                return this.committeePackageApiService.updateCommitteePackage(
                    committeePackageData,
                    committeePackageData.ratingCommittee.number || 0,
                    false, false, [], [], false
                );
            }),
            finalize(() => {
                this.contentLoaderService.hide();
                this.casesService.router.navigateByUrl(`${AppRoutes.RATING_RECOMMENDATION}`);
            })
        )
        .subscribe(
            () => console.log('Rating recommendation data loaded successfully'),
            error => {
                console.error('Failed to load rating recommendation data:', error);
                this.contentLoaderService.hide();
            }
        );
}

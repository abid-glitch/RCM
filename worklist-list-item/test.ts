private navigateToRatingRecommendationPage() {
    this.contentLoaderService.show();
    
    // Step 1: Get case data and prepare entities
    this.casesService.getCaseById(this.case.id)
        .pipe(
            tap(committeeSupport => {
                console.log('Case data loaded:', committeeSupport);
                
                // Store the case data in the data service
                this.dataService.committeSupportWrapper = committeeSupport;
                
                // Create entity dictionary from case data
                this.createCurrentEntityDictionary();
                
                // Process and prepare entities
                if (committeeSupport.entities?.length) {
                    const processedEntities = committeeSupport.entities.map(entity => ({
                        ...entity,
                        ratingClasses: entity.ratingClasses || [],
                        debts: entity.debts || [],
                        outlook: entity.outlook || null,
                        rated: entity.rated || false,
                        hasRatingRecommendation: true
                    }));
                    
                    // Update data service with entities
                    this.dataService.updateSelectedEntities(processedEntities);
                    
                    // Set table mode for rating recommendation
                    this.ratingRecommendationService.setRatingsTableMode({
                        tableMode: RatingsTableMode.EditRecommendation,
                        ratingsDetails: this.selectedCaseEntityDictionary
                    });
                    
                    // Update the entities subject so subscribers get notified
                    this.ratingRecommendationService.selectedEntitiesSubject.next(processedEntities);
                }
            }),
            // Step 2: Call the committeePackageApiService to ensure entity data is properly synced
            switchMap(() => {
                // Prepare data for updateCommitteePackage call
                const committeePackageData: CommitteePackageData = {
                    caseId: this.case.id,
                    ratingCommittee: this.dataService.committeSupportWrapper.ratingCommitteeInfo || {},
                    teamSetups: this.dataService.committeSupportWrapper.teamSetup || {},
                    entityRatings: this.dataService.committeSupportWrapper.entities || [],
                    packageDocuments: this.dataService.committeSupportWrapper.packageDocuments || []
                };
                
                // Call the API to ensure data is synced
                return this.committeePackageApiService.updateCommitteePackage(
                    committeePackageData,
                    committeePackageData.ratingCommittee.number || 0,
                    false, // isAddRatingCommitteeReason
                    false, // isVoterConfirmed
                    [], // actionList - empty array as we're just saving
                    [], // publications - empty array as we're just saving
                    false, // isClose - using 'save' endpoint
                    [] // No files
                ).pipe(
                    tap(response => {
                        console.log('Committee package updated:', response);
                        
                        // If response contains updated entities, use them
                        if (response && response.entityRatings && response.entityRatings.length > 0) {
                            // Update entities with the response from the server
                            const updatedEntities = response.entityRatings.map(entity => ({
                                ...entity,
                                ratingClasses: entity.ratingClasses || [],
                                debts: entity.debts || [],
                                outlook: entity.outlook || null,
                                rated: entity.rated || false,
                                hasRatingRecommendation: true
                            }));
                            
                            // Update data service with refreshed entities
                            this.dataService.updateSelectedEntities(updatedEntities);
                            
                            // Update the entities subject again with fresh data
                            this.ratingRecommendationService.selectedEntitiesSubject.next(updatedEntities);
                        }
                    }),
                    catchError(error => {
                        console.error('Error updating committee package:', error);
                        return of(null); // Continue without failing the stream
                    })
                );
            }),
            finalize(() => {
                // Navigate to rating recommendation page
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

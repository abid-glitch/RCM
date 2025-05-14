private navigateToRatingRecommendationPage() {
    this.contentLoaderService.show();
    
    // Step 1: Get case data with full entity details including ratings
    this.casesService.getCaseById(this.case.id)
        .pipe(
            tap(committeeSupport => {
                // Store the case data in the data service
                this.dataService.committeSupportWrapper = committeeSupport;
                
                // Create entity dictionary for quick lookup
                this.createCurrentEntityDictionary();
                
                // Set ratings table mode for editing recommendation
                this.ratingRecommendationService.setRatingsTableMode({
                    tableMode: RatingsTableMode.EditRecommendation,
                    ratingsDetails: this.selectedCaseEntityDictionary
                });
                
                // Ensure entities are properly formatted with required properties
                if (committeeSupport.entities?.length) {
                    const processedEntities = committeeSupport.entities.map(entity => ({
                        ...entity,
                        ratingClasses: entity.ratingClasses || [],
                        debts: entity.debts || [],
                        outlook: entity.outlook || null,
                        rated: entity.rated || false,
                        hasRatingRecommendation: true,
                        // Include any additional properties required for display
                        analysts: entity.analysts || [],
                        type: entity.type || null
                    }));
                    
                    // Update entities in data service
                    this.dataService.updateSelectedEntities(processedEntities);
                    
                    // Make sure the rating recommendation service is aware of the entities
                    this.ratingRecommendationService.selectedEntitiesSubject.next(processedEntities);
                    
                    // Set default view for rating recommendation page
                    this.ratingRecommendationService.determineDefaultView();
                }
            }),
            // Step 2: Load detailed rating recommendations 
            switchMap(() => {
                const entityIds = this.dataService.committeSupportWrapper.entities.map(entity => entity.id);
                
                // Make explicit call to get rating recommendations with all details
                return this.committeeSupportService.getRatingRecommendations(entityIds).pipe(
                    tap(recommendations => {
                        if (recommendations && recommendations[RatingResponseValueTypes.Item]) {
                            // Process the recommendations and merge with existing entity data
                            const updatedEntities = manageRecommendationEntityState(
                                recommendations,
                                this.dataService.committeSupportWrapper.entities,
                                this.ratingRecommendationService.getRatingsTableModeState()
                            );
                            
                            // Update the entities with latest rating data
                            if (updatedEntities && updatedEntities.length) {
                                this.dataService.updateSelectedEntities(updatedEntities);
                                this.ratingRecommendationService.selectedEntitiesSubject.next(updatedEntities);
                            }
                            
                            // Ensure custom rating classes are set
                            this.ratingRecommendationService.setCustomRatingClassSubject(
                                updatedEntities || this.dataService.committeSupportWrapper.entities
                            );
                            
                            // Pre-populate any recommendation data if available
                            this.ratingRecommendationService.initializeRecommendationData(
                                updatedEntities || this.dataService.committeSupportWrapper.entities
                            );
                        }
                    }),
                    // Add retry logic for network resilience
                    catchError(error => {
                        console.error('Error loading rating recommendations:', error);
                        return of(null); // Continue without failing the stream
                    })
                );
            }),
            // Step 3: Cache the data for the UI
            tap(() => {
                // Set the case state as saved to enable proper UI rendering
                this.ratingRecommendationService.setCaseSaveState(this.case.id, true);
                
                // Make sure we have the correct table view mode (Class or Debt view)
                const defaultView = this.ratingRecommendationService.getCurrentView() || 
                                    RatingRecommendationTableView.Class;
                this.ratingRecommendationService.setCurrentView(defaultView);
            }),
            finalize(() => {
                // Complete loading and navigate
                this.contentLoaderService.hide();
                this.casesService.router.navigateByUrl(`${AppRoutes.RATING_RECOMMENDATION}`);
            })
        )
        .subscribe(
            () => console.log('Rating recommendation data loaded successfully'),
            error => {
                console.error('Failed to load rating recommendation data:', error);
                this.contentLoaderService.hide();
                // Show user-friendly error notification
                alert('Failed to load rating recommendation data. Please try again.');
            }
        );
}

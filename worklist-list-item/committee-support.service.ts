private navigateToRatingRecommendationPage() {
    this.contentLoaderService.show();
    
    // Step 1: Get case data by ID
    this.casesService.getCaseById(this.case.id)
        .pipe(
            tap(committeeSupport => {
                // Store the case data in the data service
                this.dataService.committeSupportWrapper = committeeSupport;
                
                // Create entity dictionary for rating lookup
                this.createCurrentEntityDictionary();
                
                // Process entities to ensure all required fields exist
                if (committeeSupport.entities?.length) {
                    // Set ratings table mode for editing recommendations
                    this.ratingRecommendationService.setRatingsTableMode({
                        tableMode: RatingsTableMode.EditRecommendation,
                        ratingsDetails: this.selectedCaseEntityDictionary
                    });
                    
                    // Store entities in data service
                    this.dataService.updateSelectedEntities(committeeSupport.entities);
                }
            }),
            // Step 2: Fetch rating recommendations using the actual service method
            switchMap(() => {
                const entityIds = this.dataService.committeSupportWrapper.entities.map(entity => entity.id);
                
                // Get entity details array for service parameter
                const entityDetails: [Entity[], TableModeState] = [
                    this.dataService.committeSupportWrapper.entities,
                    this.ratingRecommendationService.getRatingsTableModeState()
                ];
                
                // Use the actual service method that exists in your application
                return this.ratingRecommendationService.getRatingRecommendations(entityDetails).pipe(
                    // If there's an error, don't break the flow, continue with empty data
                    catchError(error => {
                        console.error('Error loading rating recommendations:', error);
                        return of({ [RatingResponseValueTypes.Item]: [] });
                    })
                );
            }),
            // Initialize view and finalize navigation
            tap(() => {
                // Set default view if not already set
                this.ratingRecommendationService.determineDefaultView();
                
                // Update entities in rating recommendation service
                this.ratingRecommendationService.selectedEntitiesSubject.next(
                    this.dataService.committeSupportWrapper.entities
                );
            }),
            finalize(() => {
                this.contentLoaderService.hide();
                // Navigate to rating recommendation page
                this.casesService.router.navigateByUrl(`${AppRoutes.RATING_RECOMMENDATION}`);
            })
        )
        .subscribe(
            () => console.log('Rating recommendation data loaded successfully'),
            error => {
                console.error('Failed to load rating recommendation data:', error);
                this.contentLoaderService.hide();
                // Show error message to user
                alert('Failed to load rating recommendation data. Please try again.');
            }
        );
}

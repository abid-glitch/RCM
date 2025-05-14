    private navigateToRatingRecommendationPage() {
        this.contentLoaderService.show();
        
        this.casesService.getCaseById(this.case.id)
            .pipe(
                tap(committeeSupport => {
                    console.log('Case data loaded:', committeeSupport);
                    
                    this.dataService.committeSupportWrapper = committeeSupport;
                    
                    this.createCurrentEntityDictionary();
                
                
                    if (committeeSupport.entities?.length) {
                        console.log('Setting entities in subject:', committeeSupport.entities);
                        
                        const processedEntities = committeeSupport.entities.map(entity => {
                            return {
                                ...entity,
                                hasRatingRecommendation: true
                            };
                        });

                        this.dataService.updateSelectedEntities(processedEntities)
                        this.ratingRecommendationService.selectedEntitiesSubject.next(processedEntities);
                    } else {
                        console.warn('No entities found in case data');
                    }
                }),
                finalize(() => {
                    this.contentLoaderService.hide();
                    // Navigate after ensuring data is ready
                    setTimeout(() => {
                        this.casesService.router.navigateByUrl(`${AppRoutes.RATING_RECOMMENDATION}`);
                    }, 100); // Small delay to ensure data is processed
                })
            )
            .subscribe(
                () => console.log('Navigation preparation complete'),
                error => {
                    console.error('Error preparing for navigation:', error);
                    this.contentLoaderService.hide();
                }
            )
        }

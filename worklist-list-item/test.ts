 ngOnInit() {
        // Create entity dictionary to check for proposed ratings
        this.createCurrentEntityDictionary();
        
        // Check if case has been saved/downloaded OR has proposed ratings
        const hasProposedRatings = this.checkForProposedRatings();
        const hasSavedOrDownloaded = !!this.case.caseDataReference?.lastSaveAndDownloadDate;
        
        // Show Rating Recommendation if either condition is met
        this.isshowRatingRecommendation = hasSavedOrDownloaded || hasProposedRatings;
    }
    
    // Check if any ratings have proposed values
    private checkForProposedRatings(): boolean {
        // First check if we have ratings in the dictionary
        if (Object.keys(this.selectedCaseEntityDictionary).length > 0) {
            // Check if any rating has a proposedRating value
            return Object.values(this.selectedCaseEntityDictionary).some(rating => !!rating.proposedRating);
        }
        
        // If no entities or ratings found in the dictionary, check entities directly
        if (this.case.caseDataReference?.entities) {
            for (const entity of this.case.caseDataReference.entities) {
                // Check debt ratings
                if (entity.debts?.length) {
                    for (const debt of entity.debts) {
                        if (debt.ratings?.some(rating => !!rating.proposedRating)) {
                            return true;
                        }
                    }
                }
                
                // Check rating classes
                if (entity.ratingClasses?.length) {
                    for (const ratingClass of entity.ratingClasses) {
                        if (ratingClass.ratings?.some(rating => !!rating.proposedRating)) {
                            return true;
                        }
                    }
                }
            }
        }
        
        return false;
    }

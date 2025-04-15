private initVisibleComponent() {
    // Log the feature flag state for debugging
    console.log('Rating Recommendation Table flag:', 
        this.featureFlagService.getTreatmentState(SplitTreatments.ONLINE_RATING_RECOMMENDATION_TABLE));

    if (this.featureFlagService.getTreatmentState(SplitTreatments.ONLINE_RATING_RECOMMENDATION_TABLE)) {
        // Add proper subscription handling
        this.getRatingGroup$.pipe(takeUntil(this.unSubscribe$)).subscribe(
            (subComponents) => {
                console.log('Received subComponents:', subComponents);
                this.subComponents = subComponents;
            },
            error => console.error('Error loading subComponents:', error)
        );
        
        // Optionally, add additional diagnostics to check the allowedRatingGroup filter
        this.dataService.ratingGroupType$.pipe(
            take(1)
        ).subscribe(ratingGroupType => {
            console.log('Current rating group type:', ratingGroupType);
            console.log('Is allowed rating group:', this.subComponentService.allowedRatingGroup(ratingGroupType));
        });
    } else {
        this.subComponentService.visibleComponents$
            .pipe(takeUntil(this.unSubscribe$))
            .subscribe((subComponentsOption) => {
                console.log('Received subComponentsOption:', subComponentsOption);
                this.subComponents = subComponentsOption;
            });
    }
}

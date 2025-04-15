private initVisibleComponent() {
    if (this.featureFlagService.getTreatmentState(SplitTreatments.ONLINE_RATING_RECOMMENDATION_TABLE)) {
        console.log("Using Rating Group feature flag flow");
        this.getRatingGroup$.pipe(
            tap(data => console.log("Rating Group data received:", data)),
            takeUntil(this.unSubscribe$)
        ).subscribe({
            next: (result) => console.log("Rating Group subscription success:", result),
            error: (err) => console.error("Rating Group subscription error:", err)
        });
    } else {
        console.log("Using standard visibleComponents flow");
        this.subComponentService.visibleComponents$
            .pipe(
                tap(data => console.log("Visible components data received:", data)),
                takeUntil(this.unSubscribe$)
            )
            .subscribe({
                next: (data) => {
                    console.log("Visible components subscription success:", data);
                    this.subComponents = data;
                },
                error: (err) => console.error("Visible components subscription error:", err)
            });
    }
}



get subComponentsPopulated(): VisableComponents {
    // If subComponents is null/undefined or has no entries, return a default structure
    if (!this.subComponents || Object.keys(this.subComponents).length === 0) {
        console.warn('No subcomponents data available, using default empty structure');
        // Return an empty but properly structured object
        return {
            operating: {},
            financialProfile: {},
            businessProfile: {},
            otherQualitativeConsiderations: {},
            ratingSpecificConsiderations: {},
            thirdPartySupport: {},
            capitalStructureLossSeverityGivenDefaultNotching: {}
        };
    }
    return this.subComponents;
}

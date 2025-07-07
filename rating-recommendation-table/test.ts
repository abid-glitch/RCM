// Replace the existing getter in BottomNavbarComponent with this:
get isRasDocumentRequired(): boolean {
    const rasRequired = this.dataService?.committeSupportWrapper?.rasEnabled;
    console.log('RAS Document Required:', rasRequired);
    return rasRequired || false;
}

// Update the onClickedRasDownload method to match your working version:
onClickedRasDownload(): void {
    const isOnRatingRecommendationPage = this.currentUrl?.includes('rating-recommendation');
    const isOnSetupPage = this.currentUrl?.includes('committee-setup-properties');

    if (isOnRatingRecommendationPage && !isOnSetupPage && this.isRasDocumentRequired) {
        this.saveCurrentState();
        this.initiateRasDownload();
    } else {
        this.confirmContinueSelection();
    }
}

// Add these methods exactly as in your working code:
private saveCurrentState(): void {
    if (this.dataService?.committeSupportWrapper?.committeeMemoSetup) {
        this.isSaveAction = true;
        this.loading$.next(true);

        if (this.currentUrl?.includes(AppRoutes.RATING_RECOMMENDATION)) {
            this.dataService.initialCommitteeSupport = _.cloneDeep(this.dataService.committeSupportWrapper);
        }
        this.updateOrCreateNewCase(true);
    }
}

private initiateRasDownload(): void {
    console.log("Ras Download ... ");
}

// Update the getButtonText method to match your working logic:
getButtonText(): string {
    console.log("getButtonText called, currenturl : ", this.currentUrl);
    console.log("isRasDocumentRequired : ", this.isRasDocumentRequired);
    console.log("isRatingRecommendation : ", this.isRatingRecommendation);
    console.log("isDownloadStage : ", this.isDownloadStage);
    
    // Only show RAS DOWNLOAD text when specifically on rating-recommendation page
    // and RAS document is required and not in download stage
    const isOnRatingRecommendationPage = this.currentUrl?.includes('rating-recommendation');
    const isOnSetupPage = this.currentUrl?.includes('committee-setup-properties');
    const isOnComponentSelectionPage = this.currentUrl?.includes('component-selection-setup');
    
    console.log("isOnRatingRecommendationPage : ", isOnRatingRecommendationPage);
    console.log("isOnSetupPage : ", isOnSetupPage);
    console.log("isOnComponentSelectionPage : ", isOnComponentSelectionPage);
    
    if (isOnRatingRecommendationPage && 
        !isOnSetupPage && this.isRasDocumentRequired && this.isRatingRecommendation && 
        (!!this.entityService.selectedOrgTobeImpacted?.length || this.isEntitySelectionSection) && 
        !this.isDownloadStage) {
        console.log("Returning RAS Download");
        return this.translateService.instant('navigationControl.rasDownloadLabel');
    }
    
    // Show SAVE & CONTINUE when on rating-recommendation page but RAS not required
    if (this.isRatingRecommendation && !this.isDownloadStage) { 
        console.log("Returning Save and Continue");
        console.log("selectedOrgTobeImpacted : ", this.entityService.selectedOrgTobeImpacted?.length);
        console.log("isEnitySelectionSection  :", this.isEntitySelectionSection);
        return this.translateService.instant('navigationControl.saveAndContinue');
    }
    
    // Default button text for other pages
    console.log("Returning default button text");
    return this.translateService.instant(this.navMetaData?.nextButton?.buttonLabel || 'navigationControl.continueLabel');
}

// Update the shouldShowRasDownload method:
shouldShowRasDownload(): boolean {
    const isOnRatingRecommendationPage = this.currentUrl?.includes('rating-recommendation');
    const isOnSetupPage = this.currentUrl?.includes('committee-setup-properties');

    return isOnRatingRecommendationPage && 
        !isOnSetupPage &&
        this.isRasDocumentRequired && 
        this.isRatingRecommendation && 
        (!!this.entityService.selectedOrgTobeImpacted?.length || this.isEntitySelectionSection) && 
        !this.isDownloadStage;
}

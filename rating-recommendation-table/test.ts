 getButtonText(): string {
        const isOnRatingRecommendationPage = this.currentUrl?.includes('rating-recommendation');
        const isOnSetupPage = this.currentUrl?.includes('committee-setup-properties');
        
        // Only show RAS DOWNLOAD text when specifically on rating-recommendation page
        // and RAS document is required and not in download stage
        if (isOnRatingRecommendationPage && 
            !isOnSetupPage && 
            this.isRasDocumentRequired && 
            this.isRatingRecommendation && 
            (!!this.entityService.selectedOrgTobeImpacted?.length || this.isEntitySelectionSection) && 
            !this.isDownloadStage) {
            return this.translateService.instant('navigationControl.rasDownloadLabel');
        }
        
        // For rating recommendation page, use default button text (SAVE & DOWNLOAD)
        if (this.isRatingRecommendation && 
            (!!this.entityService.selectedOrgTobeImpacted?.length || this.isEntitySelectionSection) && 
            !this.isDownloadStage) {
            return this.translateService.instant(this.navMetaData?.nextButton?.buttonLabel || 'navigationControl.saveAndDownload');
        }
        
        // Default button text for other pages
        return this.translateService.instant(this.navMetaData?.nextButton?.buttonLabel || 'navigationControl.continueLabel');
    }

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

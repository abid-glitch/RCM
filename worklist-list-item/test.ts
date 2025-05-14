private navigateToRatingRecommendationPage() {
  this.contentLoaderService.show();
  
  this.casesService.getCaseById(this.case.id)
    .pipe(
      tap(committeeSupport => {
        // Store the committee support data in the data service
        this.dataService.committeSupportWrapper = committeeSupport;
        
        // Create entity dictionary for rating details
        this.createCurrentEntityDictionary();
        
        // Process entities to ensure they have the right structure
        if (committeeSupport.entities?.length) {
          const processedEntities = committeeSupport.entities.map(entity => ({
            ...entity,
            ratingClasses: entity.ratingClasses || [],
            debts: entity.debts || [],
            outlook: entity.outlook || null,
            rated: entity.rated || false,
            hasRatingRecommendation: true
          }));
          
          // Update the data service with structured entities
          this.dataService.updateSelectedEntities(processedEntities);
          
          // Set table mode for rating recommendation
          this.ratingRecommendationService.setRatingsTableMode({
            tableMode: RatingsTableMode.EditRecommendation,
            ratingsDetails: this.selectedCaseEntityDictionary
          });
          
          // Set FIG banking rating group flag if applicable
          const isFigBankingGroup = this.checkIfFigBankingRatingGroup(committeeSupport);
          this.ratingRecommendationService.isFigBankingRatingGroup$.next(isFigBankingGroup);
          
          // Set selected template if needed
          const template = this.determineTemplate(committeeSupport);
          if (template) {
            this.ratingRecommendationService.selectedTemplateSubject.next(template);
          }
          
          // Set default view
          this.ratingRecommendationService.determineDefaultView();
          
          // Critical step: Update entities subject with proper sequence
          this.ratingRecommendationService.selectedEntitiesSubject.next(processedEntities);
        }
      }),
      // Pre-fetch rating recommendations to ensure data is loaded before navigation
      switchMap(() => {
        const entityIds = this.dataService.committeSupportWrapper.entities.map(entity => entity.id);
        return this.committeeSupportService.getRatingRecommendations(entityIds).pipe(
          tap(recommendations => {
            // Process recommendations if needed
            const currentRecommendationClasses = manageRecommendationEntityState(
              recommendations,
              this.dataService.committeSupportWrapper.entities,
              this.ratingRecommendationService.getRatingsTableModeState()
            );
            
            // Set custom rating classes if applicable
            this.ratingRecommendationService.setCustomRatingClassSubject(
              this.dataService.committeSupportWrapper.entities
            );
          }),
          catchError(error => {
            console.error('Error loading rating recommendations:', error);
            return of(null); // Continue without failing the stream
          })
        );
      }),
      finalize(() => {
        this.contentLoaderService.hide();
        this.casesService.router.navigateByUrl(
          `${AppRoutes.CASE}/${this.case.id}/${AppRoutes.RATING_RECOMMENDATION}`
        );
      })
    )
    .subscribe(
      () => console.log('Rating recommendation data loaded successfully'),
      error => {
        console.error('Failed to load rating recommendation data:', error);
        this.contentLoaderService.hide();
        // Show error notification to user
        this.notifyError('Failed to load rating recommendation data');
      }
    );
}

// Helper methods
private checkIfFigBankingRatingGroup(committeeSupport): boolean {
  const figBankingRatingGroups = [
    RatingGroupType.BankingFinanceSecurities,
    RatingGroupType.Insurance,
    RatingGroupType.NonBanking
  ];
  return figBankingRatingGroups.includes(committeeSupport.ratingGroupTemplate);
}

private determineTemplate(committeeSupport): RatingTemplate {
  if (committeeSupport.actionRequestForm && committeeSupport.ratingCommitteeMemo) {
    return RatingTemplate.ArfRcm;
  } else if (committeeSupport.actionRequestForm) {
    return RatingTemplate.Arf;
  } else {
    return RatingTemplate.Rcm;
  }
}

private notifyError(message: string) {
  // Implement based on your notification service
  // For example:
  // this.notificationService.showError(message);
}

private removeUnselectedRatingDebts(
  committeeSupportWrapper: CommitteeSupport, 
  selectedRatingRecommendationEntities: SelectedRatingRecommendationEntities
) {
  // Return early if core objects are missing
  if (!committeeSupportWrapper || !committeeSupportWrapper.entities) {
    return committeeSupportWrapper;
  }
  
  // Create safety check helper function
  const isValidBlueTableData = (blueTableData: any) => 
    blueTableData && blueTableData.data && blueTableData.data.identifier;

  committeeSupportWrapper.entities.forEach((entity) => {
    // Handle debts if they exist
    if (entity && entity.debts) {
      entity.debts.forEach((debt) => {
        if (debt && debt.ratings) {
          debt.ratings.forEach((rating) => {
            if (!rating) return;
            
            // Safely check if DEBT exists and has blueTableData
            const hasDebtData = selectedRatingRecommendationEntities && 
                               selectedRatingRecommendationEntities.DEBT && 
                               selectedRatingRecommendationEntities.DEBT.blueTableData;
            
            let blueTableData = null;
            if (hasDebtData) {
              blueTableData = selectedRatingRecommendationEntities.DEBT.blueTableData.find(
                (el) => isValidBlueTableData(el) && 
                        el.data.identifier === rating.identifier && 
                        el.data.immediateParent && 
                        el.data.immediateParent.id === entity.id
              );
            }
            
            // Only clear properties if not found in blueTableData and if properties exist
            if (!blueTableData && 
                (rating.proposedOutlook !== undefined || 
                 rating.proposedRating !== undefined || 
                 rating.proposedWatchStatus !== undefined)) {
              rating.proposedOutlook = undefined;
              rating.proposedRating = undefined;
              rating.proposedWatchStatus = undefined;
            }
          });
        }
      });
    }
    
    // Handle outlook if it exists
    if (entity && entity.outlook) {
      // Safely check if CLASS exists and has blueTableData
      const hasClassData = selectedRatingRecommendationEntities && 
                          selectedRatingRecommendationEntities.CLASS && 
                          selectedRatingRecommendationEntities.CLASS.blueTableData;
      
      let blueTableData = null;
      if (hasClassData) {
        blueTableData = selectedRatingRecommendationEntities.CLASS.blueTableData.find(
          (el) => isValidBlueTableData(el) && 
                  el.data.identifier === entity.outlook.identifier && 
                  el.data.immediateParent && 
                  el.data.immediateParent.id === entity.id
        );
      }
      
      if (!blueTableData && entity.outlook.proposedOutlook !== undefined) {
        entity.outlook.proposedOutlook = undefined;
      }
    }
  });
  
  return committeeSupportWrapper;
}

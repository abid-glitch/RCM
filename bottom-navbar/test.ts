private removeUnselectedRatingDebts(
    committeeSupportWrapper: CommitteeSupport,
    selectedRatingRecommendationEntities: SelectedRatingRecommendationEntities
) {
    // Return early if any required objects are missing
    if (!committeeSupportWrapper || !selectedRatingRecommendationEntities) {
        return committeeSupportWrapper;
    }

    // Check if entities exist
    if (!committeeSupportWrapper.entities) {
        return committeeSupportWrapper;
    }

    committeeSupportWrapper.entities.forEach((entity) => {
        // Process debts if DEBT exists in selectedRatingRecommendationEntities
        if (entity.debts && selectedRatingRecommendationEntities.DEBT) {
            entity.debts.forEach((debt) => {
                if (debt.ratings) {
                    debt.ratings.forEach((rating) => {
                        const blueTableData = selectedRatingRecommendationEntities.DEBT.blueTableData?.find(
                            (el) => el.data?.identifier === rating.identifier && el.data?.immediateParent?.id === entity.id
                        );
                        if (
                            !blueTableData &&
                            !!(rating.proposedOutlook || rating.proposedRating || rating.proposedWatchStatus)
                        ) {
                            rating.proposedOutlook = undefined;
                            rating.proposedRating = undefined;
                            rating.proposedWatchStatus = undefined;
                        }
                    });
                }
            });
        }
        
        // Process outlook if CLASS exists in selectedRatingRecommendationEntities
        if (entity.outlook && selectedRatingRecommendationEntities.CLASS) {
            const blueTableData = selectedRatingRecommendationEntities.CLASS.blueTableData?.find(
                (el) => el.data?.identifier === entity.outlook.identifier && el.data?.immediateParent?.id === entity.id
            );
            if (!blueTableData && !!entity.outlook.proposedOutlook) {
                entity.outlook.proposedOutlook = undefined;
            }
        }
    });
    
    return committeeSupportWrapper;
}

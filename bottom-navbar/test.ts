private removeUnselectedRatingDebts(
    committeeSupportWrapper: CommitteeSupport,
    selectedRatingRecommendationEntities: SelectedRatingRecommendationEntities
) {
    // Check if DEBT exists before trying to access its properties
    if (!selectedRatingRecommendationEntities.DEBT) {
        return committeeSupportWrapper; // Return unmodified if DEBT is null/undefined
    }

    committeeSupportWrapper.entities.forEach((entity) => {
        if (entity.debts) {
            entity.debts.forEach((debt) => {
                debt.ratings.forEach((rating) => {
                    const blueTableData = selectedRatingRecommendationEntities.DEBT.blueTableData.find(
                        (el) => el.data.identifier === rating.identifier && el.data.immediateParent.id === entity.id
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
            });
        }
        if (entity.outlook) {
            const blueTableData = selectedRatingRecommendationEntities.CLASS.blueTableData.find(
                (el) => el.data.identifier === entity.outlook.identifier && el.data.immediateParent.id === entity.id
            );
            if (!blueTableData && !!entity.outlook.proposedOutlook) {
                entity.outlook.proposedOutlook = undefined;
            }
        }
    });
    return committeeSupportWrapper;
}

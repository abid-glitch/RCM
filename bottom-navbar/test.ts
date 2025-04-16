private removeUnselectedRatingDebts(
        committeeSupportWrapper: CommitteeSupport,
        selectedRatingRecommendationEntities: SelectedRatingRecommendationEntities
    ) {
        if (!committeeSupportWrapper?.entities) {
            return committeeSupportWrapper;
        }

        committeeSupportWrapper.entities.forEach((entity) => {
            if (entity.debts) {
                entity.debts.forEach((debt) => {
                    debt.ratings.forEach((rating) => {
                        // Check that DEBT and blueTableData exist before trying to access them
                        const blueTableData = selectedRatingRecommendationEntities?.DEBT?.blueTableData?.find(
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
                // Check that CLASS and blueTableData exist before trying to access them
                const blueTableData = selectedRatingRecommendationEntities?.CLASS?.blueTableData?.find(
                    (el) => el.data.identifier === entity.outlook.identifier && el.data.immediateParent.id === entity.id
                );
                if (!blueTableData && !!entity.outlook.proposedOutlook) {
                    entity.outlook.proposedOutlook = undefined;
                }
            }
        });
        return committeeSupportWrapper;
    }

    private removeUnselectedRatingClasses(
        committeeSupportWrapper: CommitteeSupport,
        selectedRatingRecommendationEntities: SelectedRatingRecommendationEntities
    ) {
        if (!committeeSupportWrapper?.entities) {
            return committeeSupportWrapper;
        }

        committeeSupportWrapper.entities.forEach((entity) => {
            if (entity.ratingClasses) {
                entity.ratingClasses.forEach((ratingClass) => {
                    ratingClass.ratings.forEach((rating) => {
                        // Check that CLASS and blueTableData exist before trying to access them
                        const blueTableData = selectedRatingRecommendationEntities?.CLASS?.blueTableData?.find(
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
                // Check that CLASS and blueTableData exist before trying to access them
                const blueTableData = selectedRatingRecommendationEntities?.CLASS?.blueTableData?.find(
                    (el) => el.data.identifier === entity.outlook.identifier && el.data.immediateParent.id === entity.id
                );
                if (!blueTableData && !!entity.outlook.proposedOutlook) {
                    entity.outlook.proposedOutlook = undefined;
                }
            }
        });

        return committeeSupportWrapper;
    }

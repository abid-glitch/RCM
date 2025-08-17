// 1. SERVICE CHANGES (RatingRecommendationService)

// Add this method to synchronize parent-child states
private synchronizeParentChildStates(tableData: BlueTableData): void {
    if (!tableData) return;
    
    tableData.forEach((parentRow) => {
        if (parentRow.children && parentRow.children.length > 0) {
            const selectableChildren = parentRow.children.filter(child => !child.data?.isSubTableHeader);
            
            if (selectableChildren.length === 0) {
                parentRow.isSelected = false;
                parentRow.isIndeterminate = false;
                return;
            }
            
            const selectedChildren = selectableChildren.filter(child => child.isSelected);
            
            if (selectedChildren.length === 0) {
                parentRow.isSelected = false;
                parentRow.isIndeterminate = false;
            } else if (selectedChildren.length === selectableChildren.length) {
                parentRow.isSelected = true;
                parentRow.isIndeterminate = false;
            } else {
                parentRow.isSelected = false;
                parentRow.isIndeterminate = true;
            }
        }
    });
}

// Update the existing manageTableDataActions method
private manageTableDataActions([blueTableDataMap, selectedRatingRecommendationEntities, viewType]: [
    RatingRecommendationTableMappedResponse,
    SelectedRatingRecommendationEntities,
    RatingRecommendationTableView
]): BlueTableData {
    const selectedRatingRecommendationEntity = selectedRatingRecommendationEntities[viewType];
    const tableData = blueTableDataMap?.blueTableDataMap[viewType];

    if (selectedRatingRecommendationEntity?.checkBoxEvent) {
        this.applySelectionToTableData(selectedRatingRecommendationEntity, tableData, viewType);
    }

    // Mapping selection from Class to Debt view
    if (viewType === RatingRecommendationTableView.Debt) {
        this.syncDebtViewSelection(selectedRatingRecommendationEntities, tableData);
    }

    // NEW: Always synchronize parent-child states after any selection changes
    this.synchronizeParentChildStates(tableData);

    return tableData;
}

// Your existing method stays mostly the same, just ensure change detection:
onSelectedRatingEntity(selectedEntities: SelectedRatingRecommendationEntities) {
    this.ratingRecommendationService.setSelectedRatingRecommendationEntities(selectedEntities);
    
    // Ensure change detection runs after the observable chain completes
    this.cdrRef.detectChanges();
}

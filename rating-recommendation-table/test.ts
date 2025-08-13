// Add this method to handle parent-child checkbox synchronization
private updateParentCheckboxState(): void {
    // Get all child checkboxes in the current table view
    const childRows = this.ratingRecommendation?.[0]?.children || [];
    const checkedChildren = childRows.filter(row => row.checked === true);
    const parentRow = this.ratingRecommendation?.[0];
    
    if (parentRow) {
        if (checkedChildren.length === 0) {
            // No children checked - uncheck parent
            parentRow.checked = false;
            parentRow.indeterminate = false;
        } else if (checkedChildren.length === childRows.length) {
            // All children checked - check parent
            parentRow.checked = true;
            parentRow.indeterminate = false;
        } else {
            // Some children checked - set parent to indeterminate
            parentRow.checked = false;
            parentRow.indeterminate = true;
        }
    }
}

// Update the existing method
onEntityTableCheckBoxSelected(
    checkBoxEvent: { checked: boolean; scope: BlueTableCheckboxScope },
    entityDetails = null
) {
    // Handle child checkbox changes
    if (checkBoxEvent.scope === BlueTableCheckboxScope.Row && entityDetails) {
        // Update the specific row's checked state
        const childRows = this.ratingRecommendation?.[0]?.children || [];
        const targetRow = childRows.find(row => 
            row.data.identifier === entityDetails.identifier || 
            row.data.id === entityDetails.id ||
            JSON.stringify(row.data) === JSON.stringify(entityDetails)
        );
        if (targetRow) {
            (targetRow as any).checked = checkBoxEvent.checked;
            (targetRow as any).isSelected = checkBoxEvent.checked;
        }
        
        // Update parent checkbox state based on children
        this.updateParentCheckboxState();
    }
    
    // Handle parent checkbox changes (Entity Name/ID)
    if (checkBoxEvent.scope === BlueTableCheckboxScope.All) {
        const childRows = this.ratingRecommendation?.[0]?.children || [];
        // Update all children to match parent state
        childRows.forEach(row => {
            (row as any).checked = checkBoxEvent.checked;
            (row as any).isSelected = checkBoxEvent.checked;
        });
        
        // Update parent state
        const parentRow = this.ratingRecommendation?.[0];
        if (parentRow) {
            (parentRow as any).checked = checkBoxEvent.checked;
            (parentRow as any).indeterminate = false;
            (parentRow as any).isSelected = checkBoxEvent.checked;
        }
    }

    // Force change detection by creating a new reference
    this.ratingRecommendation = [...this.ratingRecommendation];

    this.manageCheckboxSelected.next({
        [this.selectedTableView]: {
            blueTableData: this.selectedEntity.get(this.selectedTableView),
            checkBoxEvent: checkBoxEvent,
            entityDetails: entityDetails
        } as SelectionDetails
    });
}

// Also update the emitSelectedEntities method to handle the state properly
private emitSelectedEntities(checkboxSelected: SelectedRatingRecommendationEntities) {
    if (checkboxSelected) {
        // Update the table data to reflect current checkbox states
        this.updatedRatingRecommendation.emit(this.ratingRecommendation);
        
        const selectedEntities: SelectedRatingRecommendationEntities = {
            [this.selectedTableView]: {
                ...checkboxSelected[this.selectedTableView],
                blueTableData: this.selectedEntity.get(this.selectedTableView)
            }
        };

        this.selectedEntityChanged.emit({
            ...selectedEntities
        });
    }
}

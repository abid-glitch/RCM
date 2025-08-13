// Update the existing method
onEntityTableCheckBoxSelected(
    checkBoxEvent: { checked: boolean; scope: BlueTableCheckboxScope },
    entityDetails = null
) {
    // Handle child checkbox changes
    if (checkBoxEvent.scope === BlueTableCheckboxScope.Row && entityDetails) {
        // Update the specific row's checked state
        const childRows = this.ratingRecommendation?.[0]?.children || [];
        const targetRow = childRows.find(row => row.data.identifier === entityDetails.identifier);
        if (targetRow) {
            (targetRow as any).checked = checkBoxEvent.checked;
        }
        
        // Update parent checkbox state based on children
        this.updateParentCheckboxState();
        
        // Get the effective parent state after update
        const parentState = this.getEffectiveParentState();
        
        // Emit with the parent's effective state and scope as "All" to trigger proper parent handling
        this.manageCheckboxSelected.next({
            [this.selectedTableView]: {
                blueTableData: this.selectedEntity.get(this.selectedTableView),
                checkBoxEvent: {
                    checked: parentState.checked,
                    scope: BlueTableCheckboxScope.All
                },
                entityDetails: null // Set to null for parent-level changes
            } as SelectionDetails
        });
        return;
    }
    
    // Handle parent checkbox changes (Entity Name/ID)
    if (checkBoxEvent.scope === BlueTableCheckboxScope.All) {
        const childRows = this.ratingRecommendation?.[0]?.children || [];
        // Update all children to match parent state
        childRows.forEach(row => {
            (row as any).checked = checkBoxEvent.checked;
        });
        
        // Update parent state
        const parentRow = this.ratingRecommendation?.[0];
        if (parentRow) {
            (parentRow as any).checked = checkBoxEvent.checked;
            (parentRow as any).indeterminate = false;
        }
        
        this.manageCheckboxSelected.next({
            [this.selectedTableView]: {
                blueTableData: this.selectedEntity.get(this.selectedTableView),
                checkBoxEvent: checkBoxEvent,
                entityDetails: entityDetails
            } as SelectionDetails
        });
    }
}

// Add this helper method to get the effective parent state
private getEffectiveParentState(): { checked: boolean; indeterminate: boolean } {
    const childRows = this.ratingRecommendation?.[0]?.children || [];
    const checkedChildren = childRows.filter(row => (row as any).checked === true);
    
    if (checkedChildren.length === 0) {
        return { checked: false, indeterminate: false };
    } else if (checkedChildren.length === childRows.length) {
        return { checked: true, indeterminate: false };
    } else {
        return { checked: false, indeterminate: true };
    }
}

// Update the existing method to handle indeterminate state properly
private updateParentCheckboxState(): void {
    const childRows = this.ratingRecommendation?.[0]?.children || [];
    const checkedChildren = childRows.filter(row => (row as any).checked === true);
    const parentRow = this.ratingRecommendation?.[0];
    
    if (parentRow) {
        if (checkedChildren.length === 0) {
            // No children checked - uncheck parent
            (parentRow as any).checked = false;
            (parentRow as any).indeterminate = false;
        } else if (checkedChildren.length === childRows.length) {
            // All children checked - check parent
            (parentRow as any).checked = true;
            (parentRow as any).indeterminate = false;
        } else {
            // Some children checked - set parent to indeterminate
            (parentRow as any).checked = false;
            (parentRow as any).indeterminate = true;
        }
    }
}

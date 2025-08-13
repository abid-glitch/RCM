// Complete fix for the checkbox synchronization bug
onEntityTableCheckBoxSelected(
    checkBoxEvent: { checked: boolean; scope: BlueTableCheckboxScope },
    entityDetails = null
) {
    const childRows = this.ratingRecommendation?.[0]?.children || [];
    const parentRow = this.ratingRecommendation?.[0];
    
    // Handle child checkbox changes (individual Class/Debt rows)
    if (checkBoxEvent.scope === BlueTableCheckboxScope.Row && entityDetails) {
        // Update the specific row's checked state
        const targetRow = childRows.find(row => row.data.identifier === entityDetails.identifier);
        if (targetRow) {
            targetRow.isSelected = checkBoxEvent.checked;
            (targetRow as any).checked = checkBoxEvent.checked;
        }
        
        // Calculate new parent state
        const checkedChildren = childRows.filter(row => row.isSelected === true);
        let parentChecked = false;
        let parentIndeterminate = false;
        
        if (checkedChildren.length === 0) {
            parentChecked = false;
            parentIndeterminate = false;
        } else if (checkedChildren.length === childRows.length) {
            parentChecked = true;
            parentIndeterminate = false;
        } else {
            parentChecked = false;
            parentIndeterminate = true;
        }
        
        // Update parent checkbox state
        if (parentRow) {
            parentRow.isSelected = parentChecked;
            (parentRow as any).checked = parentChecked;
            (parentRow as any).indeterminate = parentIndeterminate;
        }
        
        // Emit the event with parent's effective state
        this.manageCheckboxSelected.next({
            [this.selectedTableView]: {
                blueTableData: this.selectedEntity.get(this.selectedTableView),
                checkBoxEvent: {
                    checked: parentChecked,
                    scope: BlueTableCheckboxScope.All
                },
                entityDetails: null
            } as SelectionDetails
        });
        
        return;
    }
    
    // Handle parent checkbox changes (Entity Name/ID)
    if (checkBoxEvent.scope === BlueTableCheckboxScope.All) {
        // Update all children to match parent state
        childRows.forEach(row => {
            row.isSelected = checkBoxEvent.checked;
            (row as any).checked = checkBoxEvent.checked;
        });
        
        // Update parent state
        if (parentRow) {
            parentRow.isSelected = checkBoxEvent.checked;
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

// Remove the old updateParentCheckboxState method as it's now integrated above
// and add this helper method if needed elsewhere
private getEffectiveParentState(): { checked: boolean; indeterminate: boolean } {
    const childRows = this.ratingRecommendation?.[0]?.children || [];
    const checkedChildren = childRows.filter(row => row.isSelected === true);
    
    if (checkedChildren.length === 0) {
        return { checked: false, indeterminate: false };
    } else if (checkedChildren.length === childRows.length) {
        return { checked: true, indeterminate: false };
    } else {
        return { checked: false, indeterminate: true };
    }
}

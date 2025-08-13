// Add this property to track checkbox states
checkboxStates = new Map<string, boolean>();

// Replace your onEntityTableCheckBoxSelected method:
onEntityTableCheckBoxSelected(
    checkBoxEvent: { checked: boolean; scope: BlueTableCheckboxScope },
    entityDetails = null
) {
    console.log('Checkbox event:', checkBoxEvent, 'Entity details:', entityDetails);
    
    if (entityDetails) {
        const key = this.getCheckboxKey(entityDetails);
        this.checkboxStates.set(key, checkBoxEvent.checked);
        
        // If this is a child row, update parent
        if (entityDetails.immediateParent) {
            this.updateParentCheckbox(entityDetails.immediateParent.id);
        }
    }

    this.manageCheckboxSelected.next({
        [this.selectedTableView]: {
            blueTableData: this.selectedEntity.get(this.selectedTableView),
            checkBoxEvent: checkBoxEvent,
            entityDetails: entityDetails
        } as SelectionDetails
    });
}

private getCheckboxKey(entityDetails: any): string {
    if (entityDetails.immediateParent) {
        // This is a child row
        return `${entityDetails.immediateParent.id}_${entityDetails.identifier}`;
    } else {
        // This is a parent entity
        return `entity_${entityDetails.id}`;
    }
}

private updateParentCheckbox(parentId: string) {
    // Get all child checkboxes for this parent
    const childKeys = Array.from(this.checkboxStates.keys()).filter(key => 
        key.startsWith(`${parentId}_`)
    );
    
    // Check if any child is selected
    const hasSelectedChild = childKeys.some(key => this.checkboxStates.get(key));
    
    // Update parent checkbox state
    const parentKey = `entity_${parentId}`;
    this.checkboxStates.set(parentKey, hasSelectedChild);
    
    console.log('Updated parent checkbox:', parentKey, hasSelectedChild);
}

// Method to check if checkbox should be selected
isCheckboxSelected(entityDetails: any): boolean {
    const key = this.getCheckboxKey(entityDetails);
    return this.checkboxStates.get(key) || false;
}

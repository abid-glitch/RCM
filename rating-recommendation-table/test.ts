// Replace your existing checkbox methods with these updated versions:

onEntityTableCheckBoxSelected(
    checkBoxEvent: { checked: boolean; scope: BlueTableCheckboxScope },
    entityDetails = null
) {
    console.log('Checkbox event:', checkBoxEvent, 'Entity details:', entityDetails);
    
    if (entityDetails) {
        const key = this.getCheckboxKey(entityDetails);
        this.checkboxStates.set(key, checkBoxEvent.checked);
        
        // Handle parent-child relationship logic
        if (entityDetails.immediateParent) {
            // This is a child row - update parent based on all children
            this.updateParentCheckbox(entityDetails.immediateParent.id);
        } else {
            // This is a parent entity - update all children to match parent state
            this.updateChildrenCheckboxes(entityDetails.id, checkBoxEvent.checked);
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
    
    // Check if ANY child is selected
    const hasSelectedChild = childKeys.some(key => this.checkboxStates.get(key));
    
    // Update parent checkbox state
    const parentKey = `entity_${parentId}`;
    const previousParentState = this.checkboxStates.get(parentKey);
    
    // Only update if the state actually changed
    if (previousParentState !== hasSelectedChild) {
        this.checkboxStates.set(parentKey, hasSelectedChild);
        console.log('Updated parent checkbox:', parentKey, hasSelectedChild);
        
        // Trigger UI update for parent checkbox if needed
        // You might need to emit an event or trigger change detection here
        // depending on how your UI binds to the checkbox states
    }
}

private updateChildrenCheckboxes(parentId: string, checked: boolean) {
    // When parent is selected/deselected, update all children to match
    const childKeys = Array.from(this.checkboxStates.keys()).filter(key => 
        key.startsWith(`${parentId}_`)
    );
    
    childKeys.forEach(key => {
        this.checkboxStates.set(key, checked);
    });
    
    console.log('Updated children checkboxes for parent:', parentId, 'to:', checked);
}

// Method to check if checkbox should be selected
isCheckboxSelected(entityDetails: any): boolean {
    const key = this.getCheckboxKey(entityDetails);
    return this.checkboxStates.get(key) || false;
}

// Additional helper method to get all selected entities
getSelectedEntities(): string[] {
    const selectedKeys: string[] = [];
    this.checkboxStates.forEach((isSelected, key) => {
        if (isSelected) {
            selectedKeys.push(key);
        }
    });
    return selectedKeys;
}

// Method to clear all selections
clearAllSelections(): void {
    this.checkboxStates.clear();
    console.log('All checkboxes cleared');
}

// Method to check if parent has all children selected (for indeterminate state)
isParentIndeterminate(parentId: string): boolean {
    const childKeys = Array.from(this.checkboxStates.keys()).filter(key => 
        key.startsWith(`${parentId}_`)
    );
    
    if (childKeys.length === 0) return false;
    
    const selectedChildren = childKeys.filter(key => this.checkboxStates.get(key));
    return selectedChildren.length > 0 && selectedChildren.length < childKeys.length;
}

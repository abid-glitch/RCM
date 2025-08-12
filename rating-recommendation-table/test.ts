// Add these properties to your component class
private entityCheckboxStates = new Map<string, boolean>();
private rowCheckboxStates = new Map<string, boolean>();

// Modified method to handle entity table checkbox selection
onEntityTableCheckBoxSelected(
    checkBoxEvent: { checked: boolean; scope: BlueTableCheckboxScope },
    entityDetails = null
) {
    // Handle different scopes
    if (checkBoxEvent.scope === BlueTableCheckboxScope.All) {
        // Select/deselect all logic
        this.handleSelectAllCheckbox(checkBoxEvent.checked);
    } else if (entityDetails) {
        // Individual row selection
        this.handleIndividualRowSelection(checkBoxEvent, entityDetails);
    } else {
        // Entity level selection
        this.handleEntityLevelSelection(checkBoxEvent);
    }

    this.manageCheckboxSelected.next({
        [this.selectedTableView]: {
            blueTableData: this.selectedEntity.get(this.selectedTableView),
            checkBoxEvent: checkBoxEvent,
            entityDetails: entityDetails
        } as SelectionDetails
    });
}

private handleSelectAllCheckbox(checked: boolean) {
    // Clear all states when selecting/deselecting all
    this.entityCheckboxStates.clear();
    this.rowCheckboxStates.clear();
    
    // Update all entity and row states
    if (this.ratingRecommendation && this.ratingRecommendation[0]?.children) {
        this.ratingRecommendation[0].children.forEach(entity => {
            this.entityCheckboxStates.set(entity.data.id, checked);
            if (entity.children) {
                entity.children.forEach(row => {
                    this.rowCheckboxStates.set(this.getRowKey(entity.data.id, row.data.identifier), checked);
                });
            }
        });
    }
}

private handleEntityLevelSelection(checkBoxEvent: { checked: boolean; scope: BlueTableCheckboxScope }) {
    const currentEntity = this.selectedEntity.get(this.selectedTableView);
    if (!currentEntity || !currentEntity[0]) return;

    const entityId = currentEntity[0].data?.id;
    if (!entityId) return;

    // Update entity state
    this.entityCheckboxStates.set(entityId, checkBoxEvent.checked);

    // When entity is deselected, deselect all its child rows
    if (!checkBoxEvent.checked) {
        if (currentEntity[0].children) {
            currentEntity[0].children.forEach(row => {
                const rowKey = this.getRowKey(entityId, row.data.identifier);
                this.rowCheckboxStates.set(rowKey, false);
                // Update the actual row selection state
                row.isSelected = false;
            });
        }
    } else {
        // When entity is selected, select all its child rows
        if (currentEntity[0].children) {
            currentEntity[0].children.forEach(row => {
                const rowKey = this.getRowKey(entityId, row.data.identifier);
                this.rowCheckboxStates.set(rowKey, true);
                // Update the actual row selection state
                row.isSelected = true;
            });
        }
    }
}

private handleIndividualRowSelection(
    checkBoxEvent: { checked: boolean; scope: BlueTableCheckboxScope },
    entityDetails: any
) {
    const entityId = entityDetails?.immediateParent?.id || entityDetails?.id;
    const rowIdentifier = entityDetails?.identifier;
    
    if (!entityId || !rowIdentifier) return;

    const rowKey = this.getRowKey(entityId, rowIdentifier);
    this.rowCheckboxStates.set(rowKey, checkBoxEvent.checked);

    // Check if all child rows are selected to determine entity checkbox state
    this.updateEntityCheckboxState(entityId);
}

private updateEntityCheckboxState(entityId: string) {
    const currentEntity = this.ratingRecommendation[0]?.children?.find(
        entity => entity.data.id === entityId
    );
    
    if (!currentEntity || !currentEntity.children) return;

    // Check if all child rows are selected
    const allChildRowsSelected = currentEntity.children.every(row => {
        const rowKey = this.getRowKey(entityId, row.data.identifier);
        return this.rowCheckboxStates.get(rowKey) === true;
    });

    // Check if no child rows are selected
    const noChildRowsSelected = currentEntity.children.every(row => {
        const rowKey = this.getRowKey(entityId, row.data.identifier);
        return this.rowCheckboxStates.get(rowKey) !== true;
    });

    // Update entity checkbox state
    if (allChildRowsSelected) {
        this.entityCheckboxStates.set(entityId, true);
        currentEntity.isSelected = true;
    } else if (noChildRowsSelected) {
        this.entityCheckboxStates.set(entityId, false);
        currentEntity.isSelected = false;
    } else {
        // Partial selection - you might want to handle this case differently
        this.entityCheckboxStates.set(entityId, false);
        currentEntity.isSelected = false;
    }
}

private getRowKey(entityId: string, rowIdentifier: string): string {
    return `${entityId}_${rowIdentifier}`;
}

// Method to check if entity checkbox should be checked
isEntityCheckboxChecked(entityId: string): boolean {
    return this.entityCheckboxStates.get(entityId) || false;
}

// Method to check if row checkbox should be checked
isRowCheckboxChecked(entityId: string, rowIdentifier: string): boolean {
    const rowKey = this.getRowKey(entityId, rowIdentifier);
    return this.rowCheckboxStates.get(rowKey) || false;
}

// Add this method to reset states when view changes
private resetCheckboxStates() {
    this.entityCheckboxStates.clear();
    this.rowCheckboxStates.clear();
}

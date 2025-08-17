// ============= COMPONENT CHANGES =============
// In recommendation-table.component.ts

export class RecommendationTableComponent implements OnInit, OnDestroy, AfterViewInit {
    // ... existing properties

    // NEW: Add a subject to track individual checkbox changes
    private childCheckboxChanged$ = new Subject<{
        parentId: string;
        childIdentifier: string;
        checked: boolean;
        viewType: RatingRecommendationTableView;
    }>();

    ngOnInit(): void {
        this.initCheckboxActionObservable();
        // NEW: Initialize child checkbox tracking
        this.initChildCheckboxObservable();
    }

    // MODIFIED: Enhanced checkbox selection handler
    onEntityTableCheckBoxSelected(
        checkBoxEvent: { checked: boolean; scope: BlueTableCheckboxScope },
        entityDetails = null
    ) {
        // Emit the regular selection event
        this.manageCheckboxSelected.next({
            [this.selectedTableView]: {
                blueTableData: this.selectedEntity.get(this.selectedTableView),
                checkBoxEvent: checkBoxEvent,
                entityDetails: entityDetails
            } as SelectionDetails
        });

        // NEW: If it's a child checkbox, also emit to child tracking observable
        if (entityDetails && entityDetails.immediateParent) {
            this.childCheckboxChanged$.next({
                parentId: entityDetails.immediateParent.id,
                childIdentifier: entityDetails.identifier,
                checked: checkBoxEvent.checked,
                viewType: this.selectedTableView
            });
        }
    }

    // NEW: Initialize child checkbox change tracking
    private initChildCheckboxObservable(): void {
        this.childCheckboxChanged$
            .pipe(
                // Group changes by parent and debounce to avoid excessive updates
                debounceTime(50),
                // Pass to service for parent state recalculation
                tap((change) => {
                    this.updateParentCheckboxState(change);
                }),
                takeUntil(this.unSubscribe)
            )
            .subscribe();
    }

    // NEW: Method to update parent checkbox state
    private updateParentCheckboxState(change: {
        parentId: string;
        childIdentifier: string;
        checked: boolean;
        viewType: RatingRecommendationTableView;
    }) {
        // Get current table data
        const currentSelection = this.selectedEntity.get(this.selectedTableView);
        
        if (currentSelection) {
            // Find the parent row
            const parentRow = currentSelection.find(row => row.data.id === change.parentId);
            
            if (parentRow) {
                // Calculate new parent state based on children
                const selectableChildren = parentRow.children.filter(child => 
                    !child.data.isSubTableHeader && 
                    child.data.identifier !== undefined
                );
                
                const selectedChildren = selectableChildren.filter(child => child.isSelected);
                
                let newParentState: { checked: boolean; indeterminate: boolean };
                
                if (selectedChildren.length === 0) {
                    newParentState = { checked: false, indeterminate: false };
                } else if (selectedChildren.length === selectableChildren.length) {
                    newParentState = { checked: true, indeterminate: false };
                } else {
                    newParentState = { checked: false, indeterminate: true };
                }
                
                // Update parent state and emit if changed
                if (parentRow.isSelected !== newParentState.checked || 
                    parentRow.isIndeterminate !== newParentState.indeterminate) {
                    
                    parentRow.isSelected = newParentState.checked;
                    parentRow.isIndeterminate = newParentState.indeterminate;
                    
                    // Emit parent state change to trigger table update
                    this.manageCheckboxSelected.next({
                        [this.selectedTableView]: {
                            blueTableData: currentSelection,
                            checkBoxEvent: { 
                                checked: newParentState.checked, 
                                scope: BlueTableCheckboxScope.Row 
                            },
                            entityDetails: parentRow.data,
                            isParentStateUpdate: true // Flag to indicate this is a parent state update
                        } as SelectionDetails & { isParentStateUpdate?: boolean }
                    });
                }
            }
        }
    }

    // ... rest of existing methods
}

// ============= SERVICE CHANGES =============
// In rating-recommendation.service.ts

export class RatingRecommendationService extends RatingsTableDictionaryOperations {
    // ... existing properties

    // MODIFIED: Enhanced selection details interface
    interface EnhancedSelectionDetails extends SelectionDetails {
        isParentStateUpdate?: boolean;
    }

    // MODIFIED: Updated checkbox action observable
    private initCheckboxActionObservable(): void {
        this.manageCheckboxSelected
            .pipe(
                debounceTime(200),
                tap((checkboxSelected) => {
                    // Handle both regular selections and parent state updates
                    this.emitSelectedEntities(checkboxSelected);
                    
                    // If it's not a parent state update, proceed with normal handling
                    const selectionDetails = checkboxSelected[Object.keys(checkboxSelected)[0]] as EnhancedSelectionDetails;
                    if (!selectionDetails.isParentStateUpdate) {
                        this.handleRegularSelection(checkboxSelected);
                    }
                }),
                takeUntil(this.unSubscribe)
            )
            .subscribe();
    }

    // NEW: Separate method for regular selection handling
    private handleRegularSelection(checkboxSelected: SelectedRatingRecommendationEntities) {
        // This contains the existing logic from initCheckboxActionObservable
        // for handling regular checkbox selections
    }

    // MODIFIED: Enhanced table data management
    private manageTableDataActions([blueTableDataMap, selectedRatingRecommendationEntities, viewType]: [
        RatingRecommendationTableMappedResponse,
        SelectedRatingRecommendationEntities,
        RatingRecommendationTableView
    ]): BlueTableData {
        const selectedRatingRecommendationEntity = selectedRatingRecommendationEntities[viewType];
        const tableData = blueTableDataMap?.blueTableDataMap[viewType];
        
        if (selectedRatingRecommendationEntity?.checkBoxEvent) {
            const selectionDetails = selectedRatingRecommendationEntity as EnhancedSelectionDetails;
            
            if (selectionDetails.isParentStateUpdate) {
                // Handle parent state update - only update the specific parent
                this.updateSpecificParentState(tableData, selectionDetails);
            } else if (selectedRatingRecommendationEntity?.checkBoxEvent.scope === BlueTableCheckboxScope.Row) {
                // Handle regular row selection
                this.handleSelectionFn(selectedRatingRecommendationEntity, viewType);
            } else {
                // Handle "Select All" functionality
                tableData?.forEach((tableRowData) => {
                    tableRowData.isSelected = selectedRatingRecommendationEntity.checkBoxEvent.checked;
                    tableRowData.isIndeterminate = false;
                    tableRowData.children.forEach((rowData) => {
                        rowData.isSelected = selectedRatingRecommendationEntity.checkBoxEvent.checked;
                    });
                });
            }
        }

        // Rest of debt view logic remains the same...
        // ... existing debt view logic

        return tableData;
    }

    // NEW: Method to update specific parent state
    private updateSpecificParentState(tableData: BlueTableData, selectionDetails: EnhancedSelectionDetails) {
        if (!tableData || !selectionDetails.entityDetails) return;
        
        const parentRow = tableData.find(row => 
            row.data.id === selectionDetails.entityDetails.id
        );
        
        if (parentRow) {
            parentRow.isSelected = selectionDetails.checkBoxEvent.checked;
            parentRow.isIndeterminate = selectionDetails.entityDetails.isIndeterminate || false;
            
            // Update dictionary as well
            const parentKey = generateKey(selectionDetails.entityDetails.id, selectionDetails.entityDetails.entityTableView);
            const dictEntry = this.fullTableDictionary.get(parentKey) as BlueTableRowData;
            if (dictEntry) {
                dictEntry.isSelected = selectionDetails.checkBoxEvent.checked;
                dictEntry.isIndeterminate = selectionDetails.entityDetails.isIndeterminate || false;
            }
        }
    }

    // MODIFIED: Enhanced selection handler
    private handleSelectionFn = (selection: SelectionDetails, viewType: RatingRecommendationTableView) => {
        const checked = selection.checkBoxEvent.checked;
        const hasImmediateParent = !!selection.entityDetails.immediateParent;
        const selectionKey = hasImmediateParent
            ? generateKey(
                  selection.entityDetails.entityTableView,
                  selection.entityDetails.immediateParent.id,
                  selection.entityDetails.identifier
              )
            : generateKey(selection.entityDetails.id, viewType);

        const getTableItemFromDictionary = this.fullTableDictionary.get(selectionKey) as BlueTableRowData;

        if (hasImmediateParent) {
            // Update child state
            getTableItemFromDictionary.isSelected = checked;
            
            // Update immediate parent in dictionary
            const getImmediateParent = this.fullTableDictionary.get(
                generateKey(selection.entityDetails.immediateParent.id, viewType)
            ) as BlueTableRowData;
            
            RatingsTableDictionaryOperations.updateImmediateParentDictionaryValue(
                selection.blueTableData,
                getImmediateParent
            );
            
            // NOTE: Parent state update will be handled by the component's observable
            // No need to manually update parent here as it's handled reactively
            
        } else {
            // Parent checkbox clicked - update all children
            RatingsTableDictionaryOperations.updateImmediateParentDictionaryValue(
                selection.blueTableData,
                getTableItemFromDictionary
            );
            getTableItemFromDictionary.children.forEach((blueTableRow) => (blueTableRow.isSelected = checked));
        }
    };

    // ... rest of existing methods
}

// ============= TEMPLATE CHANGES (if needed) =============
// In recommendation-table.component.html
// Make sure checkbox change events properly pass entityDetails:

/*
<td>
  <input 
    type="checkbox" 
    [checked]="row.isSelected"
    [indeterminate]="row.isIndeterminate"
    (change)="onEntityTableCheckBoxSelected(
      {checked: $event.target.checked, scope: checkboxScope.Row}, 
      row.data
    )">
</td>
*/

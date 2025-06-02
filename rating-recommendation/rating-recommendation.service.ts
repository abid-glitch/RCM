import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, of, throwError } from 'rxjs';
import { Entity } from '../../../shared/models/Entity';
import {
    ActionMenuProp,
    CustomRatingClass,
    Debts,
    defaultSelectedRatingRecommendationEntities,
    defaultSelectedTemplateMap,
    defaultTableHeader,
    defaultTableModeState,
    ignoreRatingGroupsToViewByToggle,
    ignoreSFGRatingGroups,
    MappedRatings,
    Outlook,
    ParentTableRowDetails,
    Rating,
    RatingClasses,
    RatingRecommendation,
    RatingRecommendationHeaderDetail,
    RatingRecommendationTableMappedResponse,
    RatingRecommendationUpdatedAction,
    RatingSyncedData,
    SelectedRatingRecommendationEntities,
    SelectionDetails,
    SyncedRatingDirectionResponse,
    TableLoadingStatus,
    TableModeState
} from '../interfaces';
import {
    catchError,
    debounceTime,
    distinctUntilChanged,
    filter,
    finalize,
    map,
    shareReplay,
    switchMap,
    take,
    tap,
    withLatestFrom
} from 'rxjs/operators';
import { RatingTemplate } from '../../../shared/models/RatingTemplate';
import {
    ProposedRecommendationTypes,
    RatingRecommendationTableView,
    RatingResponseValueTypes,
    RatingsTableMode,
    TableDataLoadingStatus
} from '../enums/rating-recommendation.enum';
import { DataService } from '../../../shared/services/data.service';
import { CommitteeSupportService } from '../../../shared/services/repos/committee-support.service';
import { BlueTableCheckboxScope, BlueTableData, BlueTableRowData } from '@moodys/blue-ng';
import { DefaultArrayRatingFlatteningKey, EntityRatingKeys, RecommendationInputTypes, stringsToMatch } from '../enums';
import { FileAccessService } from '../../../shared/services/repos/file-access-service';
import {
    createRatingClassPlaceholder,
    filterCustomRatingClass,
    generateKey,
    generateLGD,
    getEntityTypeInput,
    isDuplicateArray,
    itsRatingRecommendationEntity,
    matchSelectedArrayOrder,
    ratingsArrayFlattener,
    setRatingClassesIfNotEmpty
} from '../utils';
import { RatingGroupType } from '../../../shared/models/RatingGroupType';
import { JapanesePRDisclosure } from '../../../shared/models/JapanesePRDisclosure';
import { BulkAction, bulkActionHandler, BulkActionValue } from '../bulk-action';
import { EntityService } from '../../../shared/services/entity.service';
import { manageRecommendationEntityState } from '../utils/manageRecommendationEntityState';
import { NotificationsService } from '../../../core/services/notifications.service';
import { ErrorType } from '../../../shared/models/Notification';
import { BulkActionAlertsMessages } from '../bulk-action/bulk-action-enums/bulk-action-alerts-messages.enum';
import { RatingSyncDirection } from 'src/app/shared/models/RatingSyncDirection';
import { mergeIssuerRatingIntoDebtViewOperator } from '../custom-operators/merge-issuer-level-rating';
import { RatingsTableDictionaryOperations } from '../utils/ratings-table-dictionary-operations';
import { RatingClassMetadata } from '@app/shared/models/RatingClassMetadata';
import { RatingScaleMetadata } from '@app/shared/models/RatingScaleMetadata';
import { defaultClassReferenceNoAction } from '../interfaces/debt.interface';

@Injectable({
    providedIn: 'root'
})
export class RatingRecommendationService extends RatingsTableDictionaryOperations {
    private ratingsTableModeBehaviorSubject = new BehaviorSubject<TableModeState>(defaultTableModeState);
    ratingsTableMode$: Observable<TableModeState> = this.ratingsTableModeBehaviorSubject.asObservable();
    private readonly _customRatingClassSubject$ = new BehaviorSubject<CustomRatingClass[]>([]);
    isDownloadCompleted$ = new BehaviorSubject<boolean>(false);

    /*Emits Bulk Action*/
    action$ = new BehaviorSubject<BulkAction>(null);
    dispatchBulkAction$: Observable<BulkActionValue> = this.action$.pipe(
        bulkActionHandler(),
        shareReplay({ bufferSize: 1, refCount: false })
    );
    customRatingClasses$ = this._customRatingClassSubject$.asObservable();

    bulkActionSuccessAndWarningAlert$: Observable<void> = this.dispatchBulkAction$.pipe(
        filter((bulkAction) => !!bulkAction),
        map(() => null)
    );

    /*Manages Table Loading State*/
    protected tableDataIsLoadingStateSubject$ = new BehaviorSubject<TableLoadingStatus<TableDataLoadingStatus | ''>>(
        TableDataLoadingStatus.RetrievingData
    );
    tableDataIsLoadingState$ = this.tableDataIsLoadingStateSubject$.asObservable();

    /*Rating Group Type*/
    isFigBankingRatingGroup$ = new BehaviorSubject<boolean>(null);

    /* Observable stream that holds a list Selected Entities */
    selectedEntitiesSubject = new BehaviorSubject<Entity[]>([]);
    selectedEntities$: Observable<Entity[]> = this.selectedEntitiesSubject.asObservable().pipe(
        filter(() => !ignoreSFGRatingGroups.includes(this.dataService.getSelectedRatingGroup())),
        distinctUntilChanged(isDuplicateArray)
    );

    /* Observable stream that holds a list Selected Templates */
    protected readonly selectedTemplateSubject = new BehaviorSubject<RatingTemplate>(null);
    selectedTemplate$: Observable<string[]> = this.selectedTemplateSubject
        .asObservable()
        .pipe(map((value) => defaultSelectedTemplateMap[value]));

    private readonly ignoreViewByToggleRatingGroups$: Observable<RatingGroupType[]> = of(
        ignoreRatingGroupsToViewByToggle
    );

    /* Action Stream that Combines selectedTemplate$ and selectedEntities$
     * and returns  RatingRecommendationHeaderDetail */
    ratingRecommendationHeaderDetail$: Observable<RatingRecommendationHeaderDetail> = combineLatest([
        this.selectedTemplate$,
        this.selectedEntities$,
        this.ignoreViewByToggleRatingGroups$
    ]).pipe(
        map(([selectedTemplate, selectedEntity, ignoreViewByToggleRatingGroups]) => {
            const allowedToggleGroups = !ignoreViewByToggleRatingGroups.includes(this.selectedRatingGroup());

            return {
                expectedDate: this.dataService.committeSupportWrapper.ratingCommitteeInfo.expected || null,
                selectedTemplate: selectedTemplate,
                entityName: `${this.dataService.committeSupportWrapper.name}`,
                selectedEntityCount: selectedEntity.length,
                showContextMenu: false,
                allowedToggleGroups: allowedToggleGroups
            };
        })
    );

    /* Observable stream that holds a list of the Selected Rating Recommendation Entities */
    protected readonly selectedRatingRecommendationEntitiesSubject =
        new BehaviorSubject<SelectedRatingRecommendationEntities>(defaultSelectedRatingRecommendationEntities);
    selectedRatingRecommendationEntities$: Observable<SelectedRatingRecommendationEntities> =
        this.selectedRatingRecommendationEntitiesSubject.asObservable();

    /* Observable stream that holds the selected table view */
    protected readonly selectedRatingViewBySubject = new BehaviorSubject<RatingRecommendationTableView>(
        RatingRecommendationTableView.Class
    );

    checkIfRatingGroupIsAllowedForClassView() {
        return !ignoreRatingGroupsToViewByToggle.includes(this.dataService.getSelectedRatingGroup());
    }

    determineDefaultView() {
        this.selectedRatingViewBySubject.next(RatingRecommendationTableView.Class);
    }

    selectedRatingViewBy$: Observable<RatingRecommendationTableView> = this.selectedRatingViewBySubject.asObservable();

    /* Holds the list of all Rating Recommendation Data Table */
    getAllEntityRatingRecommendation$: Observable<RatingRecommendationTableMappedResponse> =
        this.selectedEntities$.pipe(
            withLatestFrom(this.ratingsTableMode$),
            switchMap((entityDetails) => this.getRatingRecommendations(entityDetails)),
            map((ratingResp) => ratingResp.items),
            filter((ratings) => !!ratings),
            map((response) => matchSelectedArrayOrder(response, this.formatToMatch())),
            tap((recommendations) => this.updateSupportWrapperEntity([...recommendations])),
            map((recommendations) => this.ratingRecommendationResponseData(recommendations)),
            shareReplay({ bufferSize: 1, refCount: false }),
            catchError(this.handleError.bind(this))
        );

    /* Get Rating Recommendations */
    getRatingRecommendations(
        entityDetails: [Entity[], TableModeState]
    ): Observable<Record<string, RatingRecommendation[]>> {
        const [entities, ratingsTableMode] = entityDetails;
        if (itsRatingRecommendationEntity(this.dataService.committeSupportWrapper.entities)) {
            this.setCustomRatingClassSubject(this.dataService.committeSupportWrapper.entities);
            return of({
                [RatingResponseValueTypes.Item]: this.dataService.committeSupportWrapper.entities
            }).pipe(switchMap((ratings) => this._listenToCustomRatingClassChanges(ratings)));
        }

        this.setTableLoadingState(TableDataLoadingStatus.RetrievingData);
        return this.committeeSupportService.getRatingRecommendations(entities.map((val) => val.id)).pipe(
            map((recommendations) => {
                const currentRecommendationClasses = manageRecommendationEntityState(
                    recommendations,
                    this.dataService.committeSupportWrapper.entities,
                    ratingsTableMode
                );

                this.setCustomRatingClassSubject(this.dataService.committeSupportWrapper.entities);

                return currentRecommendationClasses;
            }),
            finalize(() => {
                this.setTableLoadingState(TableDataLoadingStatus.RetrievingDataCompleted);
                this.setRatingsTableMode(defaultTableModeState);
            }),
            switchMap((ratings) => this._listenToCustomRatingClassChanges(ratings))
        );
    }

    setCustomRatingClassSubject(entities: Entity[]) {
        const addedClasses: CustomRatingClass[] = [];
        for (const entity of entities.filter((e) => e.ratingClasses)) {
            let ratingClassPosition = 0;
            for (const ratingClass of entity.ratingClasses) {
                if (!ratingClass.ratings[0]?.value && ratingClass.ratings[0]?.published === false) {
                    ratingClass.ratings[0].added = true;
                    ratingClass.id = ratingClass.ratings[0].identifier.toString();
                    addedClasses.push({
                        entityId: entity.id,
                        domicile: entity.domicile,
                        ratingClass,
                        positionIndex: new Date().getTime() + ratingClassPosition
                    });
                    ratingClassPosition++;
                }
            }
        }

        if (addedClasses.length > 0) {
            this._customRatingClassSubject$.next(addedClasses);
        }
    }

    clearCustomRatingClasses() {
        this._customRatingClassSubject$.next([]);
    }

    private _listenToCustomRatingClassChanges(
        ratingsRecord: Record<string, RatingRecommendation[]>
    ): Observable<Record<string, RatingRecommendation[]>> {
        return this._customRatingClassSubject$.pipe(
            map((customRatingClasses) => ({
                [RatingResponseValueTypes.Item]: ratingsRecord[RatingResponseValueTypes.Item].map(
                    (ratingRecommendation) =>
                        this._extractFilteredRatingClass(ratingRecommendation, customRatingClasses)
                )
            }))
        );
    }

    private _extractFilteredRatingClass(ratingRecomm: RatingRecommendation, customRatingClasses: CustomRatingClass[]) {
        const changedRatingClasses = customRatingClasses
            .filter((custom) => custom.entityId === ratingRecomm.id)
            .sort((a, b) => (a.positionIndex > b.positionIndex ? 1 : -1))
            .map((e) => e.ratingClass);

        return {
            ...ratingRecomm,

            ratingClasses: [
                ...(ratingRecomm.ratingClasses ?? []).filter((e) => !e?.ratings?.some((e) => e.added)),
                ...changedRatingClasses
            ]
        };
    }

    allRatingsWithIssuerLevelRatingInDebtView$ = this.getAllEntityRatingRecommendation$.pipe(
        map((recommendations) =>
            !recommendations.blueTableDataMap.CLASS
                ? { blueTableDataMap: { ['CLASS']: [], ['DEBT']: [] } }
                : recommendations
        ),
        mergeIssuerRatingIntoDebtViewOperator(this.addItemsToTableDictionary.bind(this)),
        shareReplay({ bufferSize: 1, refCount: false })
    );

    onAddRatingClass() {
        const selectedEntity = this.selectedRatingRecommendationEntitiesSubject.getValue();
        const entities = this._getFilteredEntities(selectedEntity);
        if (entities.length) {
            const addedClasses: CustomRatingClass[] = entities.map(createRatingClassPlaceholder.bind(this));
            this._customRatingClassSubject$.next([...this._customRatingClassSubject$.getValue(), ...addedClasses]);
            return addedClasses;
        }
        return [];
    }

    private _getFilteredEntities(
        selectedEntity: SelectedRatingRecommendationEntities
    ): { id: string; domicile: string }[] {
        return (
            selectedEntity.CLASS?.blueTableData
                .filter((e) => e.data?.type && e.isSelected && e.data?.id)
                .map((e) => ({ id: e.data.id, domicile: e.data.domicile })) ?? []
        );
    }

    removeRatingClass(identifier: string) {
        const customExistingRatingClasses = this._customRatingClassSubject$.getValue();
        if (customExistingRatingClasses.length) {
            const updatedRatingClasses = customExistingRatingClasses.flatMap((customRatingClass) =>
                setRatingClassesIfNotEmpty(filterCustomRatingClass(customRatingClass, identifier), customRatingClass)
            );
            this._customRatingClassSubject$.next(updatedRatingClasses);
        }
    }

    updateSelectionFromClassView(blueTableDataMap: RatingRecommendationTableMappedResponse) {
        const tableData = blueTableDataMap?.blueTableDataMap[RatingRecommendationTableView.Class];

        tableData.forEach((tableRowData) => {
            tableRowData.children.forEach((rowData) => {
                if (!rowData.data.isSubTableHeader) {
                    const immediateParentId = rowData.data.immediateParent.id;

                    const identifier = rowData.data.identifier;
                    const name = rowData.data.name;
                    const currency = rowData.data.currency;

                    let rowTableData: BlueTableRowData = { data: {} };

                    if (
                        rowData.data.immediateParent.id === immediateParentId &&
                        (rowData.data.identifier === identifier ||
                            (rowData.data.name === name && rowData.data.currency === currency))
                    ) {
                        rowTableData = { ...rowData };
                    }

                    rowTableData.children = [];

                    const selectedEntities: SelectedRatingRecommendationEntities = {
                        DEBT: {
                            blueTableData: tableData,
                            checkBoxEvent: { checked: rowTableData.isSelected, scope: BlueTableCheckboxScope.Row },
                            entityDetails: rowTableData.data
                        }
                    };
                    this.setSelectedRatingRecommendationEntities(selectedEntities);
                }
            });
        });
    }

    /*Holds the list of Entity Of the Debt View Table*/
    ratingRecommendationsTableData$: Observable<BlueTableData> = combineLatest([
        this.allRatingsWithIssuerLevelRatingInDebtView$,
        this.selectedRatingRecommendationEntities$,
        this.selectedRatingViewBy$
    ]).pipe(map((tableData) => this.manageTableDataActions(tableData)));

    /* Returns the  status of the bulk action button */
    enableGroupActionButton$: Observable<boolean> = combineLatest([
        this.selectedRatingViewBy$,
        this.selectedRatingRecommendationEntities$
    ]).pipe(
        map(([viewBy, selectedRatingRecommendationEntities]) => {
            const numberOfEntityToBeRated = 1;
            if (selectedRatingRecommendationEntities[viewBy]) {
                const entities = selectedRatingRecommendationEntities[viewBy].blueTableData
                    .filter((entityRatings) => !entityRatings.isIndeterminate)
                    .concat(
                        ...selectedRatingRecommendationEntities[viewBy].blueTableData
                            .filter((entityRatings) => entityRatings.isIndeterminate)
                            .map((entityRatings) => entityRatings.children)
                    )
                    .filter((entity) => entity.isSelected);
                const entityToBeRated = entities.filter((entityRatings) => {
                    return !entityRatings.children?.length && !entityRatings.data.isSubTableHeader;
                });
                return entityToBeRated.length >= numberOfEntityToBeRated;
            }
            return false;
        }),
        debounceTime(100)
    );

    /*Get recommendations Drop down*/
    getRecommendationsDropdownOptionMapping$: Observable<any> = this.fileAccessService
        .getRecommendationsDropdownOptionMapping()
        .pipe(
            shareReplay({ bufferSize: 1, refCount: false }),
            map((dropDownData) => {
                return {
                    ...dropDownData,
                    [RecommendationInputTypes.LDG]: [...dropDownData[RecommendationInputTypes.LDG], ...generateLGD()]
                };
            })
        );

    enableCustomRatingClassButton$: Observable<boolean> = this.selectedRatingRecommendationEntitiesSubject.pipe(
        map((selectedEntities) => {
            const hasEntityIds = !!this._getFilteredEntities(selectedEntities).length;

            return hasEntityIds;
        })
    );

    constructor(
        private dataService: DataService,
        private entityService: EntityService,
        private committeeSupportService: CommitteeSupportService,
        private fileAccessService: FileAccessService,
        private notificationsService: NotificationsService
    ) {
        super();
    }

    getRatingClasses(): Observable<RatingClassMetadata[]> {
        return this.committeeSupportService.getRatingClasses().pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }

    /*Starts the Ratings Data Stream */
    initializeRatingRecommendationDataStream() {
        this.getAllEntityRatingRecommendation$.pipe(take(1)).subscribe();
    }

    private generateBulkActionAlertMesage(message: BulkActionAlertsMessages, actionType: string, actionCount: number) {
        return message.replace('<%actionType%>', actionType).replace('<%actionCount%>', actionCount.toString());
    }

    /*Function to add selected entity rating recommendations to entity list*/

    private updateSupportWrapperEntity(ratingRecommendations: RatingRecommendation[]) {
        const selectedEntities: Entity[] = [];
        if (ratingRecommendations.length) {
            for (const entity of this.dataService.committeSupportWrapper.entities) {
                const entityRecommendation = ratingRecommendations.find(
                    (recommendations) => recommendations.id === entity.id
                );
                const updatedEntity: Entity = {
                    ...entity,
                    ratingClasses: entityRecommendation.ratingClasses,
                    debts: entityRecommendation.debts,
                    outlook: entityRecommendation.outlook
                };
                selectedEntities.push(updatedEntity);
            }
            this.dataService.updateSelectedEntities(selectedEntities);
        }
    }

    /*Rating Recommendation Response Data Mapping*/
    private ratingRecommendationResponseData(
        ratingRecommendations: RatingRecommendation[]
    ): RatingRecommendationTableMappedResponse {
        return {
            blueTableDataMap: {
                [RatingRecommendationTableView.Class]: this.mapToGroupTableDataEntityTree(
                    ratingRecommendations,
                    RatingRecommendationTableView.Class
                ),
                [RatingRecommendationTableView.Debt]: this.mapToGroupTableDataEntityTree(
                    ratingRecommendations,
                    RatingRecommendationTableView.Debt
                )
            }
        };
    }

    /*Build group table data entity tree*/
    private mapToGroupTableDataEntityTree(
        allRatingsRecommendation: RatingRecommendation[],
        tableView: RatingRecommendationTableView
    ): BlueTableData {
        if (!allRatingsRecommendation.length) {
            return;
        }
        return allRatingsRecommendation.map((ratingRecommendation, index) =>
            this.mappedGroupTableRowItemData(ratingRecommendation, tableView, index)
        );
    }

    /*Mapped to Grouped Table Data with children by class view */
    private mappedGroupTableRowItemData(
        ratingRecommendation: RatingRecommendation,
        viewType: RatingRecommendationTableView,
        parentIndex: number
    ): BlueTableRowData {
        const rowDetails: ParentTableRowDetails = {
            id: ratingRecommendation.id,
            type: ratingRecommendation.type,
            rated: ratingRecommendation.rated,
            name: ratingRecommendation.name,
            domicile: ratingRecommendation.domicile,
            ratingGroupType: this.ratingGroupType(),
            isFigBankingRatingGroup: this.figBankingRatingGroup()
        };
        const groupedTableData = {
            data: {
                ...rowDetails
            },
            children: this.mapToBlueTableData<Debts | RatingClasses>(
                rowDetails,
                viewType,
                ratingRecommendation.outlook,
                viewType === RatingRecommendationTableView.Class
                    ? ratingsArrayFlattener(
                          parentIndex,
                          EntityRatingKeys.ratingClasses,
                          ratingRecommendation.ratingClasses
                      )
                    : ratingsArrayFlattener(parentIndex, EntityRatingKeys.debts, ratingRecommendation.debts)
            ),
            isExpanded: true,
            isSelected: false
        };
        this.fullTableDictionary.set(generateKey(rowDetails.id, viewType), groupedTableData);

        return groupedTableData;
    }

    /*Mapped To blue Data WithDefault Header and Outlook*/
    private mapToBlueTableData<RatingType extends Debts | RatingClasses>(
        immediateParent: ParentTableRowDetails,
        viewType: RatingRecommendationTableView,
        outlook: Outlook,
        ratings: RatingType[] = []
    ): BlueTableData {
        const selectedRatingRecommendationEntities = this.selectedRatingRecommendationEntitiesSubject.value;
        /* Add outlook to children if present */
        if (outlook) {
            const mapToOutlookBlueRowData: Record<string, any> = {
                ...outlook,
                ratingDescription: {},
                ratings: [outlook]
            };
            ratings.unshift(mapToOutlookBlueRowData as RatingType);
        }
        /* Add default header */
        ratings.unshift(defaultTableHeader as RatingType);
        /* Return Ratings */
        return ratings.map((rating) => {
            const isSelected = this.getIsSelected(selectedRatingRecommendationEntities, rating);

            let refRatings = [];

            if (!rating.added && rating.refRatings) {
                refRatings = rating.refRatings;
            } else if (rating.added && (rating as RatingClasses)?.ratingDescription?.refRatings) {
                refRatings = (rating as RatingClasses)?.ratingDescription?.refRatings;
            }

            let recommendationInputType = RatingRecommendationService.getRecommendationInputType(rating.name);
            if ((rating as RatingClasses)?.ratingDescription?.ratings?.[0]?.recommendationInputType) {
                recommendationInputType = (rating as RatingClasses)?.ratingDescription?.ratings[0]
                    ?.recommendationInputType;
            }

            const ratingsData = {
                data: {
                    ...rating,
                    refRatings,
                    identifier: rating.identifier,
                    recommendationInputType,
                    entityLevelRating: RatingRecommendationService.ratingIsEntityLevel(rating.ratingClassBadges),
                    entityTableView: viewType,
                    immediateParent: immediateParent
                } as unknown as MappedRatings,
                isExpanded: true,
                isSelected
            };

            this.addItemsToTableDictionary(viewType, ratingsData);
            return ratingsData;
        });
    }

    private getIsSelected(selectedRatingRecommendationEntities: SelectedRatingRecommendationEntities, rating: any) {
        let isSelected = false;

        if (selectedRatingRecommendationEntities.CLASS !== null) {
            for (const selectedRatingRecommendationEntity of selectedRatingRecommendationEntities.CLASS.blueTableData) {
                isSelected =
                    !!selectedRatingRecommendationEntity.children.find(
                        (el) => el.isSelected && el.data.identifier === rating.identifier
                    ) ||
                    (selectedRatingRecommendationEntity.children.length === 0 &&
                        selectedRatingRecommendationEntity.isSelected &&
                        selectedRatingRecommendationEntity.data.identifier === rating.identifier);

                if (isSelected) {
                    break;
                }
            }
        } else {
            isSelected = !!(rating.proposedOutlook || rating.proposedRating || rating.proposedWatchStatus);
        }
        return isSelected;
    }

    /*Generate Input type for each ratting */
    private static getRecommendationInputType(ratingName: string): RecommendationInputTypes {
        switch (true) {
            case getEntityTypeInput(ratingName, [stringsToMatch.Outlook]):
                return RecommendationInputTypes.OUTLOOK;
            case getEntityTypeInput(ratingName, [stringsToMatch.LossGivenDefault, stringsToMatch.LGD]):
                return RecommendationInputTypes.LDG;
            default:
                return RecommendationInputTypes.RATING_CLASS;
        }
    }

    /*Returns true if rating is entity level */
    private static ratingIsEntityLevel(ratingClass: string[] = []): boolean {
        return ratingClass.includes(' Entity');
    }

    /*Returns a new copy of the rating table data */
    private manageTableDataActions([blueTableDataMap, selectedRatingRecommendationEntities, viewType]: [
        RatingRecommendationTableMappedResponse,
        SelectedRatingRecommendationEntities,
        RatingRecommendationTableView
    ]): BlueTableData {
        const selectedRatingRecommendationEntity = selectedRatingRecommendationEntities[viewType];
        const tableData = blueTableDataMap?.blueTableDataMap[viewType];
        if (selectedRatingRecommendationEntity?.checkBoxEvent) {
            if (selectedRatingRecommendationEntity?.checkBoxEvent.scope === BlueTableCheckboxScope.Row) {
                this.handleSelectionFn(selectedRatingRecommendationEntity, viewType);
            } else {
                tableData?.forEach((tableRowData) => {
                    tableRowData.isSelected = selectedRatingRecommendationEntity.checkBoxEvent.checked;
                    tableRowData.children.forEach((rowData) => {
                        rowData.isSelected = selectedRatingRecommendationEntity.checkBoxEvent.checked;
                    });
                });
            }
        }
        if (viewType === RatingRecommendationTableView.Debt) {
            /**
             * @description
             * 1 step: Build lookup maps from tableData and unselect all
             * 2 step: Use the maps to updated matches from selected Ratings
             */

            const mapByImmediateParentIdentifier = new Map<string, BlueTableRowData>();
            const mapByImmediateParentNameCurrency = new Map<string, BlueTableRowData>();

            selectedRatingRecommendationEntity?.blueTableData.forEach((tableRow) => {
                tableRow.children.forEach((row) => {
                    const immediateParentId = row.data.immediateParent.id;
                    const identifier = row.data.identifier;
                    const name = row.data.name;
                    const currency = row.data.currency;

                    const immediateParentIdentifierKey = getImmediateParentIdentifierKey(immediateParentId, identifier);
                    const immediateParentNameCurrencyKey = getImmediateParentNameCurrencyKey(
                        immediateParentId,
                        name,
                        currency
                    );

                    mapByImmediateParentIdentifier.set(immediateParentIdentifierKey, row);
                    mapByImmediateParentNameCurrency.set(immediateParentNameCurrencyKey, row);
                });
            });

            tableData.forEach((tableRow) => {
                tableRow.children.forEach((row) => {
                    row.isSelected = false;
                    const immediateParentId = row.data.immediateParent.id;
                    const identifier = row.data.identifier;
                    const name = row.data.name;
                    const currency = row.data.currency;

                    const immediateParentIdentifierKey = getImmediateParentIdentifierKey(immediateParentId, identifier);
                    const immediateParentNameCurrencyKey = getImmediateParentNameCurrencyKey(
                        immediateParentId,
                        name,
                        currency
                    );
                    const selectedRatingRecommendationRow =
                        mapByImmediateParentIdentifier.get(immediateParentIdentifierKey) ||
                        mapByImmediateParentNameCurrency.get(immediateParentNameCurrencyKey);

                    if (selectedRatingRecommendationRow) {
                        selectedRatingRecommendationRow.data = {
                            ...selectedRatingRecommendationRow.data,
                            [ProposedRecommendationTypes.proposedWatchStatus]: row.data.proposedWatchStatus,
                            [ProposedRecommendationTypes.proposedOutlook]: row.data.proposedOutlook,
                            [ProposedRecommendationTypes.proposedRating]: row.data.proposedRating
                        };
                        row.isSelected = selectedRatingRecommendationRow.isSelected;
                    }
                });
            });

            mapByImmediateParentIdentifier.clear();
            mapByImmediateParentNameCurrency.clear();
        }

        function getImmediateParentIdentifierKey(immediateParentId: string, identifier: string): string {
            return `${immediateParentId}|${identifier}`;
        }

        function getImmediateParentNameCurrencyKey(immediateParentId: string, name: string, currency: string): string {
            return `${immediateParentId}|${name}|${currency}`;
        }

        return tableData;
    }

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

        /*Check item in dictionary */
        if (hasImmediateParent) {
            getTableItemFromDictionary.isSelected = checked;
            const getImmediateParent = this.fullTableDictionary.get(
                generateKey(selection.entityDetails.immediateParent.id, viewType)
            ) as BlueTableRowData;
            RatingsTableDictionaryOperations.updateImmediateParentDictionaryValue(
                selection.blueTableData,
                getImmediateParent
            );
        } else {
            RatingsTableDictionaryOperations.updateImmediateParentDictionaryValue(
                selection.blueTableData,
                getTableItemFromDictionary
            );
            getTableItemFromDictionary.children.forEach((blueTableRow) => (blueTableRow.isSelected = checked));
        }
    };

    updateRecommendation(changes: RatingRecommendationUpdatedAction) {
        const { rating, proposedRatingType, proposedRating } = changes;
        const selectionKey = generateKey(rating.entityTableView, rating.immediateParent.id, rating.identifier);
        /* Update Map*/
        (this.fullTableDictionary.get(selectionKey) as BlueTableRowData).data = { ...rating };

        /*Update Original Data with Proposed rating*/
        if (getEntityTypeInput(changes.rating.name, [stringsToMatch.Outlook])) {
            this.manageOutLookChanges(rating, proposedRatingType, proposedRating);
        } else {
            this.updateOriginalEntityDataArray(changes);
        }

        this.dataService.updateRatingSyncDirection(
            rating.entityTableView === RatingRecommendationTableView.Class
                ? RatingSyncDirection.ClassToDebt
                : RatingSyncDirection.DebtToClass
        );
    }

    private updateOriginalEntityDataArray(changes: RatingRecommendationUpdatedAction): void {
        const { originDataRef } = changes.rating;
        const [mainItem, itemArray, item, entityKey] = originDataRef;

        /*Get Item Using Reference Tree*/
        const ratingItem =
            this.dataService.committeSupportWrapper.entities[mainItem][entityKey][itemArray][
                DefaultArrayRatingFlatteningKey
            ][item];

        ratingItem[changes.proposedRatingType] = changes.proposedRating;
    }

    /*Manages Observable Data Stream Of Selected Entities And Fig Banking Status  */
    setSelectedEntities(entity: Entity[]): void {
        this.selectedEntitiesSubject.next(entity);
        /*Update selected ratingGroups*/
        this.isFigBankingRatingGroup$.next(this.figBankingRatingGroup());
    }

    /*Manage Observable Data Stream RatingsTableMode*/
    setRatingsTableMode(ratingsTableMode: TableModeState) {
        this.ratingsTableModeBehaviorSubject.next(ratingsTableMode);
    }

    /*Manages Observable Data Stream Of Selected Template  */
    setSelectedTemplate(selectedOption: RatingTemplate) {
        this.selectedTemplateSubject.next(selectedOption);
    }

    changeRatingTableViewBy(
        viewBy: RatingRecommendationTableView,
        syncedRatingRecommendations: RatingSyncedData
    ): void {
        /*ResetTable BulkAction If ANY*/
        this.resetBulkAction();
        if (syncedRatingRecommendations && syncedRatingRecommendations.entities.length) {
            this.initRatingSyncDirectionAndUpdateTableDic(syncedRatingRecommendations.entities);
            this.dataService.updateRatingSyncDirection(null);
        }
        this.selectedRatingViewBySubject.next(viewBy);
        this.setTableLoadingState(TableDataLoadingStatus.RetrievingDataCompleted);
    }

    initRatingSyncDirectionAndUpdateTableDic(syncedRatingRecommendations: RatingRecommendation[] = []): void {
        for (const entity of syncedRatingRecommendations) {
            const debt = entity.debts ?? [];
            const ratingClass = entity.ratingClasses ?? [];

            this.manageSyncedOutlook(entity.outlook, entity.id);
            this.manageSyncRecommendations(entity.id, ratingClass, RatingRecommendationTableView.Class);
            this.manageSyncRecommendations(entity.id, debt, RatingRecommendationTableView.Debt);
        }
    }

    /*Manages Observable Data Stream Of Selected Rating Recommendation Entity  */
    setSelectedRatingRecommendationEntities(selectedEntities: SelectedRatingRecommendationEntities) {
        this.selectedRatingRecommendationEntitiesSubject.next({
            ...this.selectedRatingRecommendationEntitiesSubject.value,
            ...selectedEntities
        });
    }

    /*Set Table Loading State*/
    setTableLoadingState(tableLoadingState: TableLoadingStatus<TableDataLoadingStatus | ''>) {
        this.tableDataIsLoadingStateSubject$.next(tableLoadingState);
    }

    //Handles Request Error
    private handleError(error: any): Observable<never> {
        this.notificationsService.addNotification(error, ErrorType.API_ERROR);
        return throwError(() => error);
    }

    /* Manage Selected Entity */
    private manageOutLookChanges(rating, proposedRatingType, proposedRating) {
        const selectedEntity = this.dataService.committeSupportWrapper.entities.find(
            (entity) => entity.id === rating.immediateParent.id
        );

        selectedEntity.outlook = {
            ...selectedEntity.outlook,
            [proposedRatingType]: proposedRating
        };
    }

    onBulkActionReceived(bulkAction: ActionMenuProp<string | number>) {
        this.action$.next({
            selected: this.selectedRatingRecommendationEntitiesSubject.value,
            actionDispatched: bulkAction
        });
    }

    private resetBulkAction() {
        this.action$.next(null);
    }

    private formatToMatch(): Entity[] {
        return this.entityService.selectedOrgTobeImpacted as unknown as Entity[];
    }

    private ratingGroupType(): RatingGroupType {
        return this.dataService.committeSupportWrapper.ratingGroupTemplate;
    }

    private figBankingRatingGroup(): boolean {
        return this.dataService.committeSupportWrapper.ratingGroupTemplate === RatingGroupType.BankingFinanceSecurities;
    }

    resetRatingRecommendationTable(): void {
        this.selectedTemplateSubject.next(null);
        this.selectedEntitiesSubject.next([]);
        this.selectedRatingRecommendationEntitiesSubject.next(defaultSelectedRatingRecommendationEntities);
        this.selectedRatingViewBySubject.next(RatingRecommendationTableView.Class);
        this.fullTableDictionary.clear();
        this.ratingsTableModeBehaviorSubject.next(null);
        this.resetBulkAction();
    }

    onProcessNavigation() {
        if (this.action$.value) {
            this.resetBulkAction();
        }
    }

    /*Dispatch new Recommendation Action*/
    startNewRecommendation() {
        const newRecommendation: TableModeState = {
            ratingsDetails: undefined,
            tableMode: RatingsTableMode.NewRecommendation
        };
        this.setRatingsTableMode(newRecommendation);
    }

    /*Rating SyncDirection Helpers*/
    getSyncedRating(): SyncedRatingDirectionResponse {
        return this.committeeSupportService.getRatingsSyncedData(
            this.dataService.committeSupportWrapper.entities,
            this.dataService.committeSupportWrapper.ratingSyncDirection
        );
    }

    private manageSyncedOutlook(ratingOutlook: Outlook, entityRatingId: string) {
        if (!ratingOutlook) return;

        const classKey = generateKey(RatingRecommendationTableView.Class, entityRatingId, ratingOutlook?.identifier);
        const debtKey = generateKey(RatingRecommendationTableView.Debt, entityRatingId, ratingOutlook?.identifier);

        // sync class
        const tableClassOutlookReference = (this.fullTableDictionary.get(classKey) as BlueTableRowData)?.data;
        (this.fullTableDictionary.get(classKey) as BlueTableRowData).data = {
            ...tableClassOutlookReference,
            [ProposedRecommendationTypes.proposedOutlook]: ratingOutlook.proposedOutlook
        };
        // sync debt
        const tableDebtOutlookReference = (this.fullTableDictionary.get(debtKey) as BlueTableRowData)?.data;
        (this.fullTableDictionary.get(debtKey) as BlueTableRowData).data = {
            ...tableDebtOutlookReference,
            [ProposedRecommendationTypes.proposedOutlook]: ratingOutlook.proposedOutlook
        };

        this.manageOutLookChanges(
            tableClassOutlookReference,
            ProposedRecommendationTypes.proposedOutlook,
            ratingOutlook.proposedOutlook
        );
    }

    private manageSyncRecommendations<T extends { ratings: Rating[]; id: string }>(
        entityId: string,
        ratings: T[],
        entityTableView: RatingRecommendationTableView
    ): void {
        for (const parentRating of ratings) {
            for (const rating of parentRating.ratings) {
                const key = generateKey(entityTableView, entityId, rating.identifier);
                const tableRatingsDicRef = (this.fullTableDictionary.get(key) as BlueTableRowData)?.data;
                /* Update Dictionary Reference */
                this.updateTableDictionary(key, rating);

                if (tableRatingsDicRef.entityLevelRating === true) {
                    const debtKey = generateKey(RatingRecommendationTableView.Debt, entityId, rating.identifier);
                    this.updateTableDictionary(debtKey, rating);
                }

                const originDataRef = tableRatingsDicRef?.originDataRef;
                /*Update Original*/
                const [mainItem, itemArray, item, entityKey] = originDataRef;
                const ratingItem =
                    this.dataService.committeSupportWrapper.entities[mainItem][entityKey][itemArray][
                        DefaultArrayRatingFlatteningKey
                    ][item];

                ratingItem[ProposedRecommendationTypes.proposedWatchStatus] = rating.proposedWatchStatus;
                ratingItem[ProposedRecommendationTypes.proposedOutlook] = rating.proposedOutlook;
                ratingItem[ProposedRecommendationTypes.proposedRating] = rating.proposedRating;
            }
        }
    }

    updateTableDictionary(key: string, rating: Rating) {
        const tableRatingDicRef = (this.fullTableDictionary.get(key) as BlueTableRowData)?.data;
        this.fullTableDictionary.get(key)['data'] = {
            ...tableRatingDicRef,
            [ProposedRecommendationTypes.proposedWatchStatus]: rating.proposedWatchStatus,
            [ProposedRecommendationTypes.proposedOutlook]: rating.proposedOutlook,
            [ProposedRecommendationTypes.proposedRating]: rating.proposedRating
        };
    }

    private addItemsToTableDictionary(viewType: RatingRecommendationTableView, tableData: BlueTableRowData) {
        const key = generateKey(viewType, tableData.data.immediateParent.id, tableData.data.identifier);

        this.fullTableDictionary.set(key, tableData);
    }

    /*Table Navigation Helpers*/
    getSelectedTemplate(): RatingTemplate {
        return this.dataService.getSelectedRatingTemplate();
    }

    selectedRatingGroup(): RatingGroupType {
        return this.dataService.getSelectedRatingGroup();
    }

    currentSyncDirection(): boolean {
        return !!this.dataService.committeSupportWrapper.ratingSyncDirection;
    }

    updateJapaneseDisclosure(selectedOption: JapanesePRDisclosure) {
        this.dataService.updateJapaneseDisclosure(selectedOption);
    }

    getCurrentRatingGroupTemplate(): RatingGroupType {
        return this.dataService.committeSupportWrapper.ratingGroupTemplate;
    }

    getRatingClassesOptions(ratingScaleCode: string, ratingScaleStrategy: string, domicile: string) {
        return this.committeeSupportService.getRatingClassesOptions(ratingScaleCode, ratingScaleStrategy, domicile);
    }

    onRatingClassChanged(
        identfier: string,
        ratingClassMetadata: RatingClassMetadata,
        ratingScaleMetadata: RatingScaleMetadata[]
    ) {
        const updatedClass = this._customRatingClassSubject$.value.find(
            (customRatingClass) => customRatingClass.ratingClass.id === identfier
        );

        updatedClass.ratingClass.name = ratingClassMetadata.ratingClassName;
        updatedClass.ratingClass.ratings[0].name = ratingClassMetadata.ratingClassName;
        updatedClass.ratingClass.ratings[0].recommendationInputType = ratingClassMetadata.ratingScaleStrategy;
        updatedClass.ratingClass.refRatings = ratingScaleMetadata
            .map((data) => {
                return {
                    value: data.ratingText,
                    rank: data.ratingRank,
                    group: data.group
                };
            })
            .sort((a, b) => {
                if (a.group !== b.group) {
                    return a.group - b.group;
                }
                return a.rank - b.rank;
            });

        updatedClass.ratingClass.refRatings.unshift(defaultClassReferenceNoAction);

        this._customRatingClassSubject$.next([
            ...this._customRatingClassSubject$.value.filter(
                (customRatingClass) => customRatingClass.ratingClass.id !== identfier
            ),
            updatedClass
        ]);
    }

    isRatingCommitteeWorkflowEnabled() {
        return (
            this.getCurrentRatingGroupTemplate() === RatingGroupType.SubSovereign ||
            this.getCurrentRatingGroupTemplate() === RatingGroupType.SovereignBond ||
            this.getCurrentRatingGroupTemplate() === RatingGroupType.SovereignMDB
        );
    }

    isRatingCommitteeWorkflowEnabledFIG() {
        return (
            this.getCurrentRatingGroupTemplate() === RatingGroupType.BankingFinanceSecurities ||
            this.getCurrentRatingGroupTemplate() === RatingGroupType.NonBanking
        );
    }

    isRatingCommitteeWorkflowEnabledCFG() {
        return this.getCurrentRatingGroupTemplate() === RatingGroupType.CFG;
    }
}

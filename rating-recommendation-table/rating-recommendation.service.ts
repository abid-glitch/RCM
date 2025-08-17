import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, of, throwError } from 'rxjs';
import { Entity } from '../../../shared/models/Entity';
import {
    ActionMenuProp,
    CustomDebt,
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
    startWith,
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
    createDebtPlaceholder,
    createRatingClassPlaceholder,
    filterCustomDebt,
    filterCustomRatingClass,
    generateKey,
    generateLGD,
    getEntityTypeInput,
    isDuplicateArray,
    itsRatingRecommendationEntity,
    matchSelectedArrayOrder,
    ratingsArrayFlattener,
    setDebtIfNotEmpty,
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
import { FeatureFlagService } from '@app/shared/services/feature-flag.service';
import { RatingViewType } from '@app/rating-recommendation/enums/entity-rating-type.enum';

@Injectable({
    providedIn: 'root'
})
export class RatingRecommendationService extends RatingsTableDictionaryOperations {
    private ratingsTableModeBehaviorSubject = new BehaviorSubject<TableModeState>(defaultTableModeState);
    ratingsTableMode$: Observable<TableModeState> = this.ratingsTableModeBehaviorSubject.asObservable();
    private readonly _customRatingClassSubject$ = new BehaviorSubject<CustomRatingClass[]>([]);
    private readonly _customDebtsSubject$ = new BehaviorSubject<CustomDebt[]>([]);

    isDownloadCompleted$ = new BehaviorSubject<boolean>(false);

    /*Emits Bulk Action*/
    action$ = new BehaviorSubject<BulkAction>(null);
    dispatchBulkAction$: Observable<BulkActionValue> = this.action$.pipe(
        bulkActionHandler(),
        shareReplay({ bufferSize: 1, refCount: false })
    );
    customRatingClasses$ = this._customRatingClassSubject$.asObservable();
    customDebts$ = this._customDebtsSubject$.asObservable();

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
        distinctUntilChanged(isDuplicateArray),
        filter((entities) => entities.length > 0)
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
    readonly selectedRatingRecommendationEntitiesSubject = new BehaviorSubject<SelectedRatingRecommendationEntities>(
        defaultSelectedRatingRecommendationEntities
    );
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
        this.updateRatingViewType(RatingRecommendationTableView.Class);
    }

    selectedRatingViewBy$: Observable<RatingRecommendationTableView> = this.selectedRatingViewBySubject.asObservable();

    /* Holds the list of all Rating Recommendation Data Table */
    getAllEntityRatingRecommendation$: Observable<any> = this.selectedEntities$.pipe(
        withLatestFrom(this.ratingsTableMode$),
        switchMap((entityDetails) => this.getRatingRecommendations(entityDetails)),
        map((ratingResp) => ratingResp.items),
        filter((ratings) => !!ratings),
        distinctUntilChanged(),
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
            this.setCustomDebts(this.dataService.committeSupportWrapper.entities);
            return of({
                [RatingResponseValueTypes.Item]: this.dataService.committeSupportWrapper.entities
            }).pipe(
                switchMap((ratings) => {
                    return this.selectedRatingViewBySubject.pipe(
                        switchMap((viewBy) => {
                            if (viewBy === RatingRecommendationTableView.Class) {
                                return this._listenToCustomRatingClassChanges(ratings);
                            } else if (viewBy === RatingRecommendationTableView.Debt) {
                                return this._listenToCustomDebtChanges(ratings);
                            }
                        })
                    );
                })
            );
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
                this.setCustomDebts(this.dataService.committeSupportWrapper.entities);

                return currentRecommendationClasses;
            }),
            finalize(() => {
                this.setTableLoadingState(TableDataLoadingStatus.RetrievingDataCompleted);
            }),
            switchMap((ratings) => {
                return this.selectedRatingViewBySubject.pipe(
                    distinctUntilChanged(),
                    switchMap((viewBy) => {
                        if (viewBy === RatingRecommendationTableView.Class) {
                            return this._listenToCustomRatingClassChanges(ratings);
                        } else if (viewBy === RatingRecommendationTableView.Debt) {
                            return this._listenToCustomDebtChanges(ratings);
                        }
                    })
                );
            })
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

    setCustomDebts(entities: Entity[]) {
        const addedDebts: CustomDebt[] = [];
        for (const entity of entities.filter((e) => e.debts)) {
            let ratingClassPosition = 0;
            for (const debt of entity.debts) {
                if (debt.ratings[0]?.added) {
                    debt.ratings[0].identifier = debt.ratings[0].identifier.toString();
                    addedDebts.push({
                        entityId: entity.id,
                        domicile: entity.domicile,
                        debt: debt,
                        positionIndex: new Date().getTime() + ratingClassPosition
                    });
                    ratingClassPosition++;
                }
            }
        }

        if (addedDebts.length > 0) {
            this._customDebtsSubject$.next(addedDebts);
        }
    }

    clearCustomRatingClasses() {
        this._customRatingClassSubject$.next([]);
    }

    clearCustomDebt() {
        this._customDebtsSubject$.next([]);
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

    private _listenToCustomDebtChanges(
        ratingsRecord: Record<string, RatingRecommendation[]>
    ): Observable<Record<string, RatingRecommendation[]>> {
        /**
         * Could be updated 1) on adding new debt
         * 2) Remove
         * 3) Debt Form change
         */
        return this._customDebtsSubject$.pipe(
            map((customDebts) => ({
                [RatingResponseValueTypes.Item]: ratingsRecord[RatingResponseValueTypes.Item].map(
                    (ratingRecommendation) => this._extractFilteredDebt(ratingRecommendation, customDebts)
                )
            }))
        );
    }

    private _extractFilteredDebt(ratingRecomm: RatingRecommendation, customDebts: CustomDebt[]) {
        const changedDebts = customDebts
            .filter((custom) => custom.entityId === ratingRecomm.id)
            .sort((a, b) => (a.positionIndex > b.positionIndex ? 1 : -1))
            .map((e) => e.debt); //!!!

        return {
            ...ratingRecomm,

            debts: [...(ratingRecomm.debts ?? []).filter((e) => !e?.ratings?.some((e) => e.added)), ...changedDebts]
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
        const entities = this._getFilteredEntities(selectedEntity, RatingRecommendationTableView.Class);
        if (entities.length) {
            const addedClasses: CustomRatingClass[] = entities.map(createRatingClassPlaceholder.bind(this));
            this._customRatingClassSubject$.next([...this._customRatingClassSubject$.getValue(), ...addedClasses]);
            return addedClasses;
        }
        return [];
    }

    onAddDebt() {
        const selectedEntity = this.selectedRatingRecommendationEntitiesSubject.getValue();
        const entities = this._getFilteredEntities(selectedEntity, RatingRecommendationTableView.Debt);
        if (entities.length) {
            const addedDebts: CustomDebt[] = entities.map(createDebtPlaceholder.bind(this));
            this._customDebtsSubject$.next([...this._customDebtsSubject$.getValue(), ...addedDebts]);
            return addedDebts;
        }
        return [];
    }

    private _getFilteredEntities(
        selectedEntity: SelectedRatingRecommendationEntities,
        viewBy: RatingRecommendationTableView
    ): { id: string; domicile: string }[] {
        return (
            selectedEntity[viewBy]?.blueTableData
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

    removeDebt(identifier: string) {
        const customExistingDebts = this._customDebtsSubject$.getValue();
        if (customExistingDebts.length) {
            const updatedDebts = customExistingDebts.flatMap((customDebt) =>
                setDebtIfNotEmpty(filterCustomDebt(customDebt, identifier), customDebt)
            );
            this._customDebtsSubject$.next(updatedDebts);
        }
    }

    /*Holds the list of Entity Of the Debt View Table*/
    ratingRecommendationsTableData$: Observable<BlueTableData> = combineLatest([
        this.allRatingsWithIssuerLevelRatingInDebtView$,
        this.selectedRatingRecommendationEntities$,
        this.selectedRatingViewBy$
    ]).pipe(map((tableData) => this.manageTableDataActions(tableData)));

     /*Holds the list of Entity Of the Debt View Table with Empty initial/default value emitted*/
    ratingRecommendationsTableDataWithEmpty$ = this.ratingRecommendationsTableData$.pipe(
        startWith([]),
        shareReplay({ bufferSize: 1, refCount: false })
    );

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
            const hasEntityIds = !!this._getFilteredEntities(selectedEntities, RatingRecommendationTableView.Class)
                .length;

            return hasEntityIds;
        })
    );

    enableAddDebtButton$: Observable<boolean> = this.selectedRatingRecommendationEntitiesSubject.pipe(
        map((selectedEntities) => {
            const hasEntityIds = !!this._getFilteredEntities(selectedEntities, RatingRecommendationTableView.Debt)
                .length;

            return hasEntityIds;
        })
    );

    constructor(
        private dataService: DataService,
        private entityService: EntityService,
        private committeeSupportService: CommitteeSupportService,
        private fileAccessService: FileAccessService,
        private notificationsService: NotificationsService,
        private featureFlagService: FeatureFlagService
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
                this.updateSelectedRRDropdownValues(updatedEntity, entity);
                selectedEntities.push(updatedEntity);
            }
            this.dataService.updateSelectedEntities(selectedEntities);
        }
    }

    private updateSelectedRRDropdownValues(updatedEntity: Entity, wrapperEntity: Entity) {
        if (wrapperEntity.outlook?.proposedOutlook) {
            updatedEntity.outlook.proposedOutlook = wrapperEntity.outlook.proposedOutlook;
        }
        updatedEntity.ratingClasses = updatedEntity.ratingClasses?.map((ratingClass) => {
            const wrapperRating = wrapperEntity.ratingClasses?.find(
                (wrapperRtng) =>
                    (wrapperRtng.id && ratingClass.id && wrapperRtng.id == ratingClass.id) ||
                    (wrapperRtng.name === ratingClass.name && wrapperRtng.currency === ratingClass.currency)
            );
            if (wrapperRating) {
                this.updateSelectedRRRatings(ratingClass, wrapperRating);
            }
            return ratingClass;
        });
    }

    private updateSelectedRRRatings(ratingClass: RatingClasses, wrapperRating: RatingClasses) {
        ratingClass.ratings = ratingClass.ratings?.map((rating) => {
            const wrapRating = wrapperRating.ratings?.find(
                (wrapperRtng) => wrapperRtng.identifier == rating.identifier
            );
            if (wrapRating) {
                if (wrapRating.proposedRating) {
                    rating.proposedRating = wrapRating.proposedRating;
                }
                if (wrapRating.proposedWatchStatus) {
                    rating.proposedWatchStatus = wrapRating.proposedWatchStatus;
                }
            }
            return rating;
        });
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
        const tableData = this.mapToBlueTableData<Debts | RatingClasses>(
            rowDetails,
            viewType,
            ratingRecommendation.outlook,
            viewType === RatingRecommendationTableView.Class
                ? ratingsArrayFlattener(parentIndex, EntityRatingKeys.ratingClasses, ratingRecommendation.ratingClasses)
                : ratingsArrayFlattener(parentIndex, EntityRatingKeys.debts, ratingRecommendation.debts)
        );

        const groupedTableData = {
            data: { ...rowDetails },
            children: tableData,
            isExpanded: true,
            isSelected: tableData.some((row) => row.isSelected)
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
        const entity = this.getEntityById(immediateParent.id);

        const selectedRatingRecommendationEntities = this.selectedRatingRecommendationEntitiesSubject.value;

        ratings = this.addOutlookAndHeader(outlook, entity, ratings);

        return ratings.map((rating) =>
            this.mapRatingToBlueTableData(
                rating,
                viewType,
                immediateParent,
                entity,
                selectedRatingRecommendationEntities
            )
        );
    }

    private getEntityById(entityId: string): Entity | undefined {
        return this.dataService.committeSupportWrapper.entities.find((entity) => entity.id === entityId);
    }
    private addOutlookAndHeader<RatingType extends Debts | RatingClasses>(
        outlook: Outlook,
        entity: Entity | undefined,
        ratings: RatingType[]
    ): RatingType[] {
        if (outlook) {
            const outlookRowData: Record<string, any> = {
                ...outlook,
                ratingDescription: {},
                ratings: [outlook],
                proposedOutlook:
                    entity?.outlook?.identifier === outlook.identifier ? entity.outlook.proposedOutlook : undefined
            };
            ratings.unshift(outlookRowData as RatingType);
        }
        ratings.unshift(defaultTableHeader as RatingType);
        return ratings;
    }

    private mapRatingToBlueTableData(
        rating: any,
        viewType: RatingRecommendationTableView,
        immediateParent: ParentTableRowDetails,
        entity: Entity | undefined,
        selectedRatingRecommendationEntities: SelectedRatingRecommendationEntities
    ): BlueTableRowData {
        const refRatings = this.getRefRatings(rating);

        const recommendationInputType = this.getRecommendationInputType(rating);

        const isSelected = this.getIsSelected(selectedRatingRecommendationEntities, rating, viewType);

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

        if (viewType === RatingRecommendationTableView.Class) {
            this.updateWithEntityClass(ratingsData, entity, rating);
        }

        if (entity) {
            this.addItemsToTableDictionary(viewType, ratingsData);
        }

        return ratingsData;
    }

    private getRefRatings(rating: any): any[] {
        if (!rating.added && rating.refRatings) {
            return rating.refRatings;
        }
        if (rating.added && (rating as RatingClasses)?.ratingDescription?.refRatings) {
            return (rating as RatingClasses)?.ratingDescription?.refRatings;
        }
        return [];
    }

    private getRecommendationInputType(rating: any): RecommendationInputTypes {
        if ((rating as RatingClasses)?.ratingDescription?.ratings?.[0]?.recommendationInputType) {
            return (rating as RatingClasses)?.ratingDescription?.ratings[0]?.recommendationInputType;
        }
        return RatingRecommendationService.getRecommendationInputType(rating.name);
    }

    private updateWithEntityClass(ratingsData: any, entity: Entity | undefined, rating: any): void {
        const entityRatingClass = entity?.ratingClasses?.find(
            (ratingClass) => ratingClass.name === rating.name && ratingClass.currency === rating.currency
        );
        const entityRatingClassRating= entityRatingClass?.ratings?.find((r: any) => r.identifier === rating.identifier);
        if (entityRatingClass) {
            ratingsData.data.proposedRating = entityRatingClassRating?.proposedRating;
            ratingsData.data.proposedWatchStatus = entityRatingClassRating?.proposedWatchStatus;
            ratingsData.data.proposedOutlook = entityRatingClassRating?.proposedOutlook;
        }
    }

    private getIsSelected(
        selectedRatingRecommendationEntities: SelectedRatingRecommendationEntities,
        rating: any,
        viewType: RatingRecommendationTableView
    ) {
        let isSelected = false;

        if (
            viewType === RatingRecommendationTableView.Class &&
            selectedRatingRecommendationEntities.CLASS !== null &&
            selectedRatingRecommendationEntities.CLASS.blueTableData.length > 0
        ) {
            isSelected = this.getIsSelectedClass(selectedRatingRecommendationEntities, rating);

            if (isSelected) {
                return true;
            }
        }

        if (
            viewType === RatingRecommendationTableView.Debt &&
            selectedRatingRecommendationEntities.DEBT !== null &&
            selectedRatingRecommendationEntities.DEBT.blueTableData.length > 0
        ) {
            isSelected = this.getIsSelectedDebt(selectedRatingRecommendationEntities, rating);

            if (isSelected) {
                return true;
            }
        }

        isSelected = !!(rating.proposedOutlook || rating.proposedRating || rating.proposedWatchStatus);

        return isSelected;
    }

    private getIsSelectedClass(
        selectedRatingRecommendationEntities: SelectedRatingRecommendationEntities,
        rating: any
    ) {
        for (const selectedRatingRecommendationEntity of selectedRatingRecommendationEntities.CLASS.blueTableData) {
            const isSelected =
                !!selectedRatingRecommendationEntity.children.find(
                    (el) => el.isSelected && el.data.identifier === rating.identifier
                ) ||
                (selectedRatingRecommendationEntity.children.length === 0 &&
                    selectedRatingRecommendationEntity.isSelected &&
                    selectedRatingRecommendationEntity.data.identifier === rating.identifier);

            if (isSelected) {
                return true;
            }
        }
    }

    private getIsSelectedDebt(selectedRatingRecommendationEntities: SelectedRatingRecommendationEntities, rating: any) {
        for (const selectedRatingRecommendationEntity of selectedRatingRecommendationEntities.DEBT.blueTableData) {
            const isSelected =
                !!selectedRatingRecommendationEntity.children.find(
                    (el) => el.isSelected && el.data.identifier === rating.identifier
                ) ||
                (selectedRatingRecommendationEntity.children.length === 0 &&
                    selectedRatingRecommendationEntity.isSelected &&
                    selectedRatingRecommendationEntity.data.identifier === rating.identifier);

            if (isSelected) {
                return true;
            }
        }

        return false;
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
            this.applySelectionToTableData(selectedRatingRecommendationEntity, tableData, viewType);
        }

        // Mapping selection from Class to Debt view not used anymore: CHECK, maybe apply only if add debt didnt happen
        if (viewType === RatingRecommendationTableView.Debt) {
            this.syncDebtViewSelection(selectedRatingRecommendationEntities, tableData);
        }

        return tableData;
    }

    private applySelectionToTableData(
        selectedRatingRecommendationEntity: SelectionDetails,
        tableData: BlueTableData,
        viewType: RatingRecommendationTableView
    ) {
        if (selectedRatingRecommendationEntity.checkBoxEvent.scope === BlueTableCheckboxScope.Row) {
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

    private syncDebtViewSelection(
        selectedRatingRecommendationEntities: SelectedRatingRecommendationEntities,
        tableData: BlueTableData
    ) {
        const classTableData = selectedRatingRecommendationEntities[RatingRecommendationTableView.Class]?.blueTableData;
        if (!classTableData || !tableData) return;

        const { mapByImmediateParentIdentifier, mapByImmediateParentNameCurrency, mapBySubTableHeader } =
            this.buildClassViewLookupMaps(classTableData);

        tableData.forEach((tableRow) => {
            if (tableRow.data.isSubTableHeader) {
                tableRow.isSelected = mapBySubTableHeader.get(tableRow.data.immediateParent.id);
            }
            tableRow.children.forEach((row) => {
                if (!row.data.added) {
                    row.isSelected = false;
                    const selectedRow = this.findSelectedRowForDebt(
                        row,
                        mapByImmediateParentIdentifier,
                        mapByImmediateParentNameCurrency
                    );
                    if (selectedRow) {
                        selectedRow.data = {
                            ...selectedRow.data,
                            [ProposedRecommendationTypes.proposedWatchStatus]: row.data.proposedWatchStatus,
                            [ProposedRecommendationTypes.proposedOutlook]: row.data.proposedOutlook,
                            [ProposedRecommendationTypes.proposedRating]: row.data.proposedRating
                        };
                        row.isSelected = selectedRow.isSelected;
                    }
                }
            });
        });

        mapByImmediateParentIdentifier.clear();
        mapByImmediateParentNameCurrency.clear();
    }

    private buildClassViewLookupMaps(classTableData: BlueTableData) {
        const mapByImmediateParentIdentifier = new Map<string, BlueTableRowData>();
        const mapByImmediateParentNameCurrency = new Map<string, BlueTableRowData>();
        const mapBySubTableHeader = new Map<string, boolean>();

        classTableData.forEach((tableRow) => {
            if (tableRow.data.isSubTableHeader) {
                mapBySubTableHeader.set(tableRow.data.immediateParent.id, true);
            }
            tableRow.children.forEach((row) => {
                const immediateParentId = row.data.immediateParent.id;
                const identifier = row.data.identifier;
                const name = row.data.name;
                const currency = row.data.currency;

                mapByImmediateParentIdentifier.set(
                    this.getImmediateParentIdentifierKey(immediateParentId, identifier),
                    row
                );
                mapByImmediateParentNameCurrency.set(
                    this.getImmediateParentNameCurrencyKey(immediateParentId, name, currency),
                    row
                );
            });
        });

        return {
            mapByImmediateParentIdentifier,
            mapByImmediateParentNameCurrency,
            mapBySubTableHeader
        };
    }

    private findSelectedRowForDebt(
        row: BlueTableRowData,
        mapByImmediateParentIdentifier: Map<string, BlueTableRowData>,
        mapByImmediateParentNameCurrency: Map<string, BlueTableRowData>
    ): BlueTableRowData | undefined {
        const immediateParentId = row.data.immediateParent.id;
        const identifier = row.data.identifier;
        const name = row.data.name;
        const currency = row.data.currency;

        return (
            mapByImmediateParentIdentifier.get(this.getImmediateParentIdentifierKey(immediateParentId, identifier)) ||
            mapByImmediateParentNameCurrency.get(
                this.getImmediateParentNameCurrencyKey(immediateParentId, name, currency)
            )
        );
    }

    private getImmediateParentIdentifierKey(immediateParentId: string, identifier: string): string {
        return `${immediateParentId}|${identifier}`;
    }

    private getImmediateParentNameCurrencyKey(immediateParentId: string, name: string, currency: string): string {
        return `${immediateParentId}|${name}|${currency}`;
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
            this.dataService.committeSupportWrapper.entities?.[mainItem]?.[entityKey]?.[itemArray]?.[
                DefaultArrayRatingFlatteningKey
            ]?.[item];

        /**
         * @description
         * It could be undefinned if the custom rating class is deleted
         */
        if (ratingItem) {
            ratingItem[changes.proposedRatingType] = changes.proposedRating;
        }
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
        this.updateRatingViewType(viewBy);
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
        if (this.dataService.committeSupportWrapper.entities.length > 0) {
            const selectedEntity = this.dataService.committeSupportWrapper.entities.find(
                (entity) => entity.id === rating.immediateParent.id
            );

            selectedEntity.outlook = {
                ...selectedEntity.outlook,
                [proposedRatingType]: proposedRating
            };
        }
    }

    onBulkActionReceived(bulkAction: ActionMenuProp<string | number>) {
        this.action$.next({
            selected: this.selectedRatingRecommendationEntitiesSubject.value,
            actionDispatched: bulkAction
        });
    }

    public resetBulkAction() {
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
        this.updateRatingViewType(RatingRecommendationTableView.Class);
        this.fullTableDictionary.clear();
        this.clearCustomRatingClasses();
        this.clearCustomDebt();
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

    private updateRatingViewType(ratingViewBy : RatingRecommendationTableView){
        this.selectedRatingViewBySubject.next(ratingViewBy);
        this.dataService.updateRatingViewType(ratingViewBy === RatingRecommendationTableView.Class ? RatingViewType.Class : RatingViewType.Debt);
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
        updatedClass.ratingClass.currency = ratingClassMetadata.currency;
        updatedClass.ratingClass.ratings[0].name = ratingClassMetadata.ratingClassName;
        updatedClass.ratingClass.ratings[0].recommendationInputType = ratingClassMetadata.ratingScaleStrategy;
        updatedClass.ratingClass.ratings[0].currency = ratingClassMetadata.currency;
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

    onDebtChanged(
        identfier: string,
        ratingClassMetadata: RatingClassMetadata,
        ratingScaleMetadata: RatingScaleMetadata[],
        name: string,
        originalFaceAmount: string,
        currencyCode: string,
        maturityDate: string
    ) {
        const updatedDebt = this._customDebtsSubject$.value.find(
            (customDebt) => customDebt.debt.id.toString() === identfier.toString()
        );
        updatedDebt.debt.name = name;
        updatedDebt.debt.currencyCode = currencyCode;
        updatedDebt.debt.originalFaceAmount = +originalFaceAmount;
        updatedDebt.debt.maturityDate = maturityDate;

        updatedDebt.debt.ratings[0].name = ratingClassMetadata.ratingClassName;
        updatedDebt.debt.ratings[0].recommendationInputType = ratingClassMetadata.ratingScaleStrategy;

        if (ratingScaleMetadata.length > 0) {
            updatedDebt.debt.refRatings = ratingScaleMetadata
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
            updatedDebt.debt.refRatings.unshift(defaultClassReferenceNoAction);
        }
        this._customDebtsSubject$.next([
            ...this._customDebtsSubject$.value.filter(
                (customDebt) => customDebt.debt.id.toString() !== identfier.toString()
            ),
            updatedDebt
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

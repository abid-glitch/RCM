import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Entity } from '../models/Entity';
import { ContentLoaderService } from './content-loader.service';
import { CommitteeSupportService } from './repos/committee-support.service';
import { SearchByType } from '../models/SearchByType';
import { DebtInformationType } from 'src/app/shared/models/DebtInfomation';
import { DataService } from './data.service';
import { FileAccessService } from './repos/file-access-service';
import { NotificationsService } from '../../core/services/notifications.service';
import { ErrorType } from '../models/Notification';
import { BlueTableData, BlueTableRowData } from '@moodys/blue-ng';
import { EntityFamily } from '../models/EntityFamily';
import { FilterCriteria } from '../models/FilterCriteria';
import { Domicile } from '../models/Domicile';
import { EntityFamilyNode } from 'src/app/shared/models/EntityFamilyNode';
import { EntityWrapper } from '../models/EntityWrapper';
import { defaultIgnoreList } from '../enums';
import { take } from 'rxjs/operators';
import { UltimateParent } from '../models/UltimateParent';

@Injectable({
    providedIn: 'root'
})
export class EntityService {
    public organizationFamilySubject: BehaviorSubject<EntityFamily>;
    public organizationFamily$: Observable<EntityFamily>;

    private entitySearchSubject: BehaviorSubject<EntityFamilyNode[]>;
    public entitySearch$: Observable<EntityFamilyNode[]>;

    private dealSearchSubject: BehaviorSubject<EntityFamilyNode[]>;
    public dealSearch$: Observable<EntityFamilyNode[]>;

    public entityCartChangeSubject: BehaviorSubject<EntityFamilyNode[]>;
    public entityCartChange$: Observable<EntityFamilyNode[]>;

    public selectedOrgTobeImpacted: Array<EntityFamilyNode>;
    public organizationFamilyData: BlueTableData;

    public entityFilterSubject: BehaviorSubject<FilterCriteria>;
    public entityFilter$: Observable<FilterCriteria>;

    private leadAnalystsSet: Set<string>;
    private localAnalystsSet: Set<string>;
    private domicileSet: Set<string>;

    public leadAnalystUniqueList: string[];
    public localAnalystUniqueList: string[];
    public domicileUniqueList: string[];

    public isInitialCartSlideCompleted = false;

    public debtInformationSubject: BehaviorSubject<DebtInformationType> = new BehaviorSubject<DebtInformationType>(
        DebtInformationType.ratingClass
    );

    /*Monitor the state of entity changes */
    entityWasUpdated = false;

    // data persistence for Organization Page
    private currentSearchTerm = '';
    private selectedSearchType: SearchByType;
    public domicileCodes = '';
    public showSearchBox = false;
    public privateRatingDisclosureResponse = false;

    public filteredSearchTerms: string[];
    public filteredDomicileOptions: string[];

    constructor(
        private committeeSupportService: CommitteeSupportService,
        private contentLoaderService: ContentLoaderService,
        private dataService: DataService,
        private notificationService: NotificationsService,
        private fileAccessService: FileAccessService
    ) {
        this.organizationFamilySubject = new BehaviorSubject(null);
        this.organizationFamily$ = this.organizationFamilySubject.asObservable();

        this.selectedOrgTobeImpacted = new Array<EntityFamilyNode>();

        this.entityCartChangeSubject = new BehaviorSubject([]);
        this.entityCartChange$ = this.entityCartChangeSubject.asObservable();

        this.entitySearchSubject = new BehaviorSubject(null);
        this.entitySearch$ = this.entitySearchSubject.asObservable();

        this.entityFilterSubject = new BehaviorSubject(null);
        this.entityFilter$ = this.entityFilterSubject.asObservable();

        this.dealSearchSubject = new BehaviorSubject(null);
        this.dealSearch$ = this.dealSearchSubject.asObservable();

        this.organizationFamilyData = new Array<BlueTableRowData>();
        this.leadAnalystsSet = new Set();
        this.localAnalystsSet = new Set();
        this.domicileSet = new Set();

        this.leadAnalystUniqueList = [];
        this.localAnalystUniqueList = [];
        this.domicileUniqueList = [];

        this.getFilteredSearchOptions();
    }

    private emitLoaderSubject(content?: string) {
        console.log(content);
        this.contentLoaderService.show();
    }

    public getPrivateRatingDisclosureResponse() {
        return this.privateRatingDisclosureResponse;
    }

    public getSelectedEntitiesToBeImpacted(): Array<EntityFamilyNode> {
        return this.selectedOrgTobeImpacted;
    }

    private getFilteredSearchOptions() {
        this.fileAccessService
            .getFilteredWordList()
            .pipe(take(1))
            .subscribe((data) => {
                data = data.replace(/\r?\n|\r/g, ',');
                this.filteredSearchTerms = data.split(',');
            });

        this.fileAccessService
            .getFilteredDomicilesList()
            .pipe(take(1))
            .subscribe((data) => {
                data = data.replace(/\r?\n|\r/g, ',');
                this.filteredDomicileOptions = data.split(',');
            });
    }

    public setPrivateRatingDisclosureResponse(response: boolean) {
        this.privateRatingDisclosureResponse = response;
    }

    manageEntityWasUpdatedStatus(updateStatus: boolean, editModeTriggered = false): void {
        if (!editModeTriggered) {
            this.entityWasUpdated = updateStatus;
        }
    }

    /*
        Helper functions to clear data from all the pages on "Cancel"
        ================================================================================================
    */

    // clear data from the entity selection window (searched entities) and search box
    public clearEntityFamilyData() {
        this.organizationFamilyData = []; // window
        this.showSearchBox = false;
        this.leadAnalystsSet = new Set();
        this.localAnalystsSet = new Set();
        this.domicileSet = new Set();
        this.leadAnalystUniqueList = [];
        this.localAnalystUniqueList = [];
        this.domicileUniqueList = [];
    }

    // clear data from the organization cart (selected entities)
    private clearSearchBoxAndCartData() {
        this.clearSelectedOrgsInCart();
        //search box reset
        this.currentSearchTerm = '';
        this.domicileCodes = '';
        this.selectedSearchType = SearchByType.entityName;
        this.debtInformationSubject.next(DebtInformationType.ratingClass);
    }

    public updateSearchTerm(searchTerm: string) {
        this.currentSearchTerm = searchTerm;
    }

    public get searchTerm(): string {
        return this.currentSearchTerm;
    }

    public clearSearchTypeOption() {
        this.selectedSearchType = null;
    }

    public updateSearchType(currentSelection: SearchByType) {
        this.selectedSearchType = currentSelection;
    }

    public get searchType(): SearchByType {
        return this.selectedSearchType;
    }

    public clearSelectedOrgsInCart() {
        this.selectedOrgTobeImpacted = new Array<EntityFamilyNode>();
    }

    public updateAnalysts(_leadAnalystsSet: Set<string>, _localAnalystsSet: Set<string>) {
        const alphaSort = (a: string, b: string) => a.localeCompare(b);

        _leadAnalystsSet?.forEach((analyst) => this.leadAnalystsSet.add(analyst));
        this.leadAnalystUniqueList = [...this.leadAnalystsSet]
            .filter((name) => name != undefined && name)
            .sort(alphaSort);

        _localAnalystsSet?.forEach((analyst) => this.localAnalystsSet.add(analyst));
        this.localAnalystUniqueList = [...this.localAnalystsSet]
            .filter((name) => name != undefined && name)
            .sort(alphaSort);
    }

    public updateDomicile(_domiciles: Array<Domicile>) {
        const filteredDomicile = _domiciles
            .filter((domicile) => domicile != undefined)
            .map((domicile) => domicile.name)
            .sort();
        this.domicileSet = new Set([...this.domicileSet, ...filteredDomicile]);
        this.domicileUniqueList = [...this.domicileSet];
    }

    // ==================================================================================================
    /*
        function that resets state for all pages (intended to only be called on "Cancel")
    */
    // ==================================================================================================

    // clear /organization
    public clearEntitySearchAndFamilyData() {
        this.organizationFamilySubject.next(null);
        this.dealSearchSubject.next(null);
        this.clearEntityFamilyData();
        this.clearSearchBoxAndCartData();
        this.dataService.clearSelectedTemplatesFromHomePage();
        this.entitySearchSubject.next(null);
    }

    searchOrganizationByAnalystName(anlystName: string, analystRole: SearchByType) {
        this.emitLoaderSubject('');
        this.clearEntityFamilyData();
        this.committeeSupportService
            .getEntitiesByAnalystName(anlystName, analystRole)
            .pipe(take(1))
            .subscribe({
                next: (data) => this.transformToEntityFamilyNode(data),
                error: (error: unknown) => this.exceptionHandler(error)
            });
    }

    transformToEntityFamilyNode(data: EntityWrapper) {
        const organizations: EntityFamilyNode[] = this.transformEntityToOrg(data.items)?.sort((a, b) =>
            a.name > b.name ? 1 : -1
        );
        this.entitySearchSubject.next(organizations);
        this.showSearchBox = true;
        this.contentLoaderService.hide();
    }

    searchOgranizationByEntityId(id: string) {
        this.emitLoaderSubject('');
        this.clearEntityFamilyData();
        this.fetchOrganizationFamily(id);
        this.entitySearchSubject.next(null);
        this.showSearchBox = false;
        this.contentLoaderService.hide();
    }

    searchOrganizationByName(organizationName: string) {
        this.emitLoaderSubject('');
        this.clearEntityFamilyData();
        const refinedOrganizationName = this.cleanUpSearchString(organizationName);
        this.committeeSupportService
            .getEntitiesByOrganizationName(refinedOrganizationName)
            .pipe(take(1))
            .subscribe({
                next: (data) => this.transformToEntityFamilyNode(data),
                error: (error: unknown) => this.exceptionHandler(error)
            });
    }

    searchOrganizationByDomicileCodes(domicileCodes: string) {
        this.emitLoaderSubject('');
        this.clearEntityFamilyData();
        this.committeeSupportService
            .getEntitiesByDomicleCodes(domicileCodes)
            .pipe(take(1))
            .subscribe({
                next: (data) => this.transformToEntityFamilyNode(data),
                error: (error: unknown) => this.exceptionHandler(error)
            });
    }

    fetchDealsById(dealId: string) {
        this.emitLoaderSubject('');
        this.dealSearchSubject.next(null);
        this.clearEntityFamilyData();
        this.committeeSupportService
            .getDealsById(dealId)
            .pipe(take(1))
            .subscribe({
                next: (data) => {
                    this.dealSearchSubject.next(this.transformEntityToOrg([data]));
                    this.contentLoaderService.hide();
                },
                error: (error: unknown) => this.exceptionHandler(error)
            });
    }

    fetchOrganizationFamily(organizationId: string) {
        this.emitLoaderSubject('');
        this.organizationFamilySubject.next(null);
        this.committeeSupportService
            .getOrganizationFamily(organizationId)
            .pipe(take(1))
            .subscribe({
                next: (data) => {
                    this.organizationFamilySubject.next(data);
                    this.contentLoaderService.hide();
                },
                error: (error: unknown) => this.exceptionHandler(error)
            });
    }

    fetchDealsByName(dealName: string) {
        this.emitLoaderSubject('');
        this.dealSearchSubject.next(null);
        this.clearEntityFamilyData();
        this.committeeSupportService
            .getDealsByName(dealName)
            .pipe(take(1))
            .subscribe({
                next: (data) => {
                    this.dealSearchSubject.next(this.transformEntityToOrg(data.items));
                    this.contentLoaderService.hide();
                },
                error: (error: unknown) => this.exceptionHandler(error)
            });
    }

    fetchDealsByAnalyst(analystName: string) {
        this.emitLoaderSubject('');
        this.dealSearchSubject.next(null);
        this.clearEntityFamilyData();
        this.committeeSupportService
            .getDealsByAnalyst(analystName)
            .pipe(take(1))
            .subscribe({
                next: (data) => {
                    this.dealSearchSubject.next(this.transformEntityToOrg(data.items));
                    this.contentLoaderService.hide();
                },
                error: (error: unknown) => this.exceptionHandler(error)
            });
    }

    private exceptionHandler(error: any) {
        this.notificationService.addNotification(error, ErrorType.API_ERROR);
        this.contentLoaderService.hide();
    }

    private transformEntityToOrg(entities: Entity[]): EntityFamilyNode[] {
        return entities?.map((data) => new EntityFamilyNode(data));
    }

    addOrgToImpactedList(selectedOrgs: EntityFamilyNode[], editModeTriggered?: boolean) {
        selectedOrgs.forEach((org) => this.selectedOrgTobeImpacted.push(org));

        this.dataService.isSelectedOrgAnalystSame = this.isLeadAnalystSame();
        this.dataService.isSelectedOrgParentSame = this.isUltimateParentSame();

        /*Set entity was changed state only when is user action*/
        this.manageEntityWasUpdatedStatus(true, editModeTriggered);
    }

    removeOrgFromImpactedList(unselectedOrgs: EntityFamilyNode[]) {
        unselectedOrgs.forEach((org) => {
            const orgIndex = this.selectedOrgTobeImpacted.findIndex(({ id }) => id === org.id);
            this.selectedOrgTobeImpacted.splice(orgIndex, 1);
        });
        const selectedEntities: Entity[] = this.populateEntities();
        this.dataService.updateSelectedEntities(selectedEntities);
        this.dataService.isSelectedOrgAnalystSame = this.isLeadAnalystSame();
        this.dataService.isSelectedOrgParentSame = this.isUltimateParentSame();

        /*Set entity was changed state*/
        this.manageEntityWasUpdatedStatus(true);
    }

    populateEntities() {
        const selectedEntities: Entity[] = [];
        this.selectedOrgTobeImpacted.forEach((org) =>
            selectedEntities.push(
                new Entity({ id: org.id, name: org.name, type: org.type, analysts: org.analysts } as Entity)
            )
        );
        return selectedEntities;
    }

    private isLeadAnalystSame(): boolean {
        let value = true;
        const leadAnalyst = new Set<string>();
        this.selectedOrgTobeImpacted.forEach((org) => {
            if (leadAnalyst.size === 0 && org.leadAnalyst) {
                org.leadAnalyst.forEach((analyst) => {
                    leadAnalyst.add(analyst.id);
                });
            }
            org.leadAnalyst?.forEach((analyst) => {
                value = value && leadAnalyst.has(analyst.id);
                if (value) return;
            });
            if (!value) return value;
        });
        return value;
    }

    private isUltimateParentSame(): boolean {
        let isSameUltimateParent = true;
        let oneOfUltimateParentId: string;
        this.selectedOrgTobeImpacted.forEach((org) => {
            if (!oneOfUltimateParentId && org.ultimateParent) {
                oneOfUltimateParentId = org.ultimateParent.id;
            } else if (org.ultimateParent && oneOfUltimateParentId !== org.ultimateParent?.id) {
                isSameUltimateParent = false;
                return;
            }
        });
        if (!oneOfUltimateParentId) return false;
        return isSameUltimateParent;
    }

    private cleanUpSearchString(orgName: string): string {
        const regx = new RegExp(defaultIgnoreList.join('|'), 'g');

        return orgName.toLowerCase().replace(regx, '');
    }

    getUltimateParents(selectedEntities: Entity[]): Observable<UltimateParent[]> {
        return this.committeeSupportService.getUltimateParent(selectedEntities.map((val) => val.id));
    }
}


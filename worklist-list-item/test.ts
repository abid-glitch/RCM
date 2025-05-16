import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';

import { BlueModalRef, BluePopoverAnchor } from '@moodys/blue-ng';
import { Case, CasesActions } from '../../types/case';
import { MenuData } from '../../types/enums/worklist.enums';

import { DataService } from 'src/app/shared/services/data.service';
import { ModalEvent } from '../../types/modalEvent';
import { Router } from '@angular/router';
import { AppRoutes } from 'src/app/routes/routes';
import { EntityService } from 'src/app/shared/services/entity.service';
import { EntityFamilyNode } from 'src/app/shared/models/EntityFamilyNode';
import { RatingRecommendationService } from 'src/app/features/rating-recommendation/services/rating-recommendation.service';
import { RatingTemplate } from 'src/app/shared/models/RatingTemplate';
import { EntityType } from 'src/app/shared/models/EntityType';
import { Entity } from 'src/app/shared/models/Entity';
import { concatMap, filter, finalize, map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { ContentLoaderService } from 'src/app/shared/services/content-loader.service';
import { AnalystRole } from 'src/app/shared/models/AnalystRole';
import {
    RatingRecommendationTableView,
    RatingsTableMode
} from '../../../features/rating-recommendation/enums/rating-recommendation.enum';
import { CaseData } from '../../../shared/types/case-data';
import { CasesService, CaseStatus } from '../../../shared/services/cases';
import { Observable, Subject, of } from 'rxjs';
import { generateKey, Rating } from '../../../features/rating-recommendation';
import { UltimateParent } from '../../../shared/models/UltimateParent';
import { RatingGroupType } from 'src/app/shared/models/RatingGroupType';
import { UserProfileService } from '../../../shared/services/user-profile-service';
import { TranslateService } from '@ngx-translate/core';
import { UserProfile } from '@app/shared/models/UserProfile';
import { FeatureFlagService } from '@app/shared/services/feature-flag.service';


@Component({
    selector: 'app-worklist-list-item',
    templateUrl: './worklist-list-item.component.html',
    styleUrls: ['./worklist-list-item.component.scss']
})
export class WorklistListItemComponent implements OnInit, OnDestroy {
    @Input()
    case: Case;
    @Input()
    menuData: Record<'text', string>[] = [];
    @Input()
    userProfile: UserProfile;

    modalRef: BlueModalRef;

    modalData: ModalEvent = {
        caseName: '',
        caseId: '',
        event: null
    };

    @Output()
    caseEvent = new EventEmitter<ModalEvent>();

    selectedCaseAction?: CasesActions;

    unSubscribe$ = new Subject<void>();

    actionRoutes: Record<string, AppRoutes> = {
        [CasesActions.CreateFromExisting]: AppRoutes.SELECT_RATING_GROUP_AND_TEMPLATE,
        [CasesActions.EditCase]: AppRoutes.ENTITY_SELECTION
    };

    ratingGroupWithNoFamilyTree: Record<RatingGroupType.SFGPrimary | RatingGroupType.SFGCoveredBonds, boolean> = {
        [RatingGroupType.SFGCoveredBonds]: true,
        [RatingGroupType.SFGPrimary]: true
    };

    selectedCaseEntityDictionary: Record<string, Rating> = {};

    @ViewChild(BluePopoverAnchor) bluePopOverElement: BluePopoverAnchor;

    userProfile$ = this.userProfileService.userProfile$.pipe(
        filter((userProfile) => !!userProfile),
        map((userProfile) => {
            return {
                createdBy: `${userProfile.firstName} ${userProfile.lastName}`,
                lastModifiedBy: `${userProfile.firstName} ${userProfile.lastName}`
            };
        })
    );

    menuIncludeRatingCommittee = false;
    isCommitteeWorkflow = false;
    isshowRatingRecommendation = false;
    isGotoRecommendationScreen: boolean = false;
    rating: Rating[];
    
    // State persistence variables
    private readonly SAVED_STATE_KEY = 'rating-recommendation-saved-state';
    private isSavedStateProcessed = false;

    constructor(
        private dataService: DataService,
        private router: Router,
        private entityService: EntityService,
        private ratingRecommendationService: RatingRecommendationService,
        public casesService: CasesService,
        private contentLoaderService: ContentLoaderService,
        private userProfileService: UserProfileService,
        public translate: TranslateService,
        public featureFlagService: FeatureFlagService
    ) {
        this.isCommitteeWorkflow =
            this.featureFlagService.isCommitteeWorkflowEnabled() ||
            this.featureFlagService.isCommitteeWorkflowEnabledFIG() ||
            this.featureFlagService.isCommitteeWorkflowEnabledCFG();
    }

    ngOnInit() {
        // Check for saved state on init
        this.checkAndLoadSavedState();
        
        const hasProposedRating = this.rating && this.rating.some(r => r.proposedRating);
        this.isshowRatingRecommendation = hasProposedRating;
        
        // Subscribe to rating state changes to persist them
        this.subscribeToRatingChanges();
    }
    
    /**
     * Checks for and loads any saved state for this case
     */
    private checkAndLoadSavedState(): void {
        if (this.case && this.case.id) {
            const savedStateKey = `${this.SAVED_STATE_KEY}-${this.case.id}`;
            const savedState = localStorage.getItem(savedStateKey);
            
            if (savedState && !this.isSavedStateProcessed) {
                try {
                    const parsedState = JSON.parse(savedState);
                    this.selectedCaseEntityDictionary = parsedState.selectedCaseEntityDictionary || {};
                    
                    // Pre-load the state into the rating recommendation service
                    if (Object.keys(this.selectedCaseEntityDictionary).length > 0) {
                        this.ratingRecommendationService.preloadSavedState(this.selectedCaseEntityDictionary);
                    }
                    
                    this.isSavedStateProcessed = true;
                } catch (error) {
                    console.error('Error restoring saved rating state:', error);
                }
            }
        }
    }
    
    /**
     * Subscribes to changes in the rating recommendation data to persist them
     */
    private subscribeToRatingChanges(): void {
        this.ratingRecommendationService.ratingChanges$
            .pipe(takeUntil(this.unSubscribe$))
            .subscribe(changes => {
                if (changes && this.case && this.case.id) {
                    // Update our local dictionary with any changes
                    this.selectedCaseEntityDictionary = {
                        ...this.selectedCaseEntityDictionary,
                        ...changes
                    };
                    
                    // Save to localStorage
                    this.persistCurrentState();
                }
            });
    }
    
    /**
     * Persists the current state to localStorage
     */
    private persistCurrentState(): void {
        if (this.case && this.case.id) {
            const savedStateKey = `${this.SAVED_STATE_KEY}-${this.case.id}`;
            const stateToSave = {
                selectedCaseEntityDictionary: this.selectedCaseEntityDictionary,
                timestamp: new Date().toISOString()
            };
            
            localStorage.setItem(savedStateKey, JSON.stringify(stateToSave));
        }
    }

    openModal(value: string) {
        /* TODO REFACTOR CODE*/
        if (value === 'Rename Case') {
            this.modalData.event = MenuData.rename;
            this.modalData.caseName = this.case.name;
            this.modalData.caseId = this.case.id;
            this.caseEvent.emit(this.modalData);
        } else if (value === 'Delete Case') {
            this.modalData.event = MenuData.delete;
            this.modalData.caseId = this.case.id;
            this.caseEvent.emit(this.modalData);
        } else if (value == 'Create New From Existing') {
            /*TODO GET VALUE FROM PROPS*/
            this.selectedCaseAction = CasesActions.CreateFromExisting;
            this.ratingRecommendationService.setRatingsTableMode({
                tableMode: RatingsTableMode.CreateNewRecommendationFromExisting,
                ratingsDetails: null
            });
            this.goToEntitySelection();
        } else if (value === 'Rating Committee') {
            this.navigateToInviteesPage();
        }
        else if (value === 'Rating Recommendation') {
            this.isGotoRecommendationScreen = true;
            this.openExistingCase();
        }
    }

    goToEntitySelection() {
        this.dataService.createNewFromExisting = true;
        this.case.caseDataReference.id = '';
        this.dataService.isExistingCase = true;
        this.prepareTransition();
    }

    prepareTransition() {
        this.clearEntity();
        this.createCommitteeSupport();
        this.dataService.updateRatingGroupSelection(this.dataService.committeSupportWrapper.ratingGroupTemplate);
        this.dataService.setSelectedJurisdiction();
        this.selectTemplateType();
        if (this.ratingGroupWithNoFamilyTree[this.dataService.committeSupportWrapper.ratingGroupTemplate]) {
            this.populateSFGEntities();
        } else {
            this.populateEntityForBasket();
        }
    }

    openExistingCase() {
        this.createCurrentEntityDictionary();
        
        // Merge with any saved state
        if (this.isSavedStateProcessed && Object.keys(this.selectedCaseEntityDictionary).length > 0) {
            // We're already using the saved state
        } else {
            // Check for saved state again just to be sure
            this.checkAndLoadSavedState();
        }
        
        this.ratingRecommendationService.setRatingsTableMode({
            tableMode: RatingsTableMode.EditRecommendation,
            ratingsDetails: this.selectedCaseEntityDictionary
        });
        
        this.selectedCaseAction = CasesActions.EditCase;
        this.dataService.isExistingCase = true;
        this.prepareTransition();
    }

    populateSFGEntities() {
        this.contentLoaderService.show();
        this.setEntityFamilyList();
        this.dataService.manageCaseDetails(
            CaseStatus.Initiated,
            this.dataService.committeSupportWrapper.entities[0]?.name
        );
        this.casesService
            .updateCase(this.dataService.committeSupportWrapper)
            .pipe(
                filter(() => this.selectedCaseAction === CasesActions.EditCase),
                finalize(() => {
                    this.contentLoaderService.hide();
                    if (this.isGotoRecommendationScreen) {
                        this.propogateSelectedEntities();
                        this.router.navigateByUrl(AppRoutes.RATING_RECOMMENDATION);
                    }
                    else {
                        this.router.navigateByUrl(this.actionRoutes[this.selectedCaseAction]);
                    }
                }),
                takeUntil(this.unSubscribe$)
            )
            .subscribe();
    }

    populateEntityForBasket() {
        this.contentLoaderService.show();
        this.entityService
            .getUltimateParents(this.case.caseDataReference.entities)
            .pipe(
                tap((ultimateParentEntity) => this.setUltimateParent(ultimateParentEntity)),
                filter(() => this.selectedCaseAction === CasesActions.CreateFromExisting),
                switchMap(() =>
                    this.dataService.manageCaseDetails(
                        CaseStatus.Initiated,
                        this.entityService.selectedOrgTobeImpacted[0]?.name
                    )
                ),
                concatMap((committeeSupportWrapper) => this.casesService.createCase(committeeSupportWrapper)),
                tap((caseResp) => this.dataService.setCaseId(caseResp.id)),
                finalize(() => {
                    this.contentLoaderService.hide();
                    if (this.isGotoRecommendationScreen) {
                        this.propogateSelectedEntities();
                        this.router.navigateByUrl(AppRoutes.RATING_RECOMMENDATION);
                    }
                    else {
                        this.router.navigateByUrl(this.actionRoutes[this.selectedCaseAction]);
                    }
                }),
                takeUntil(this.unSubscribe$)
            )
            .subscribe();
    }

    setEntityFamilyList() {
        const entityFamilyNode: EntityFamilyNode[] = [];
        this.case.caseDataReference.entities.forEach((element) => {
            const entityFamily = new EntityFamilyNode(element);
            const leadAnalyst = element.analysts?.find((analyst) => analyst.role === AnalystRole.leadAnalyst).analyst;
            entityFamily.leadAnalyst?.push(leadAnalyst);
            entityFamilyNode.push(entityFamily);
        });
        this.entityService.addOrgToImpactedList(entityFamilyNode, true);
    }

    setUltimateParent(ultimateParentEntity: UltimateParent[]) {
        const entityFamilyNode: EntityFamilyNode[] = [];
        this.case.caseDataReference.entities.forEach((selectedEntity) => {
            const entityFamily = new EntityFamilyNode(selectedEntity);
            const currentUltimateParentEntity = ultimateParentEntity.find((parent) => selectedEntity.id == parent.id);

            if (!currentUltimateParentEntity) return;
            const isOrganization = currentUltimateParentEntity.type === EntityType.Organization;
            const ultimateParent = new Entity({
                id: currentUltimateParentEntity.ultimateParent.id,
                name: currentUltimateParentEntity.ultimateParent.name,
                type: isOrganization ? EntityType.Organization : EntityType.Deal,
                analysts: null,
                rated: selectedEntity.rated
            } as Entity);
            entityFamily.ultimateParent = new EntityFamilyNode(ultimateParent);

            const leadAnalyst = selectedEntity.analysts?.find(
                (analyst) => analyst.role === AnalystRole.leadAnalyst
            ).analyst;
            entityFamily.leadAnalyst?.push(leadAnalyst);
            entityFamilyNode.push(entityFamily);
        });
        this.entityService.addOrgToImpactedList(entityFamilyNode, true);
    }

    selectTemplateType() {
        if (this.case.caseDataReference.actionRequestForm && this.case.caseDataReference.ratingCommitteeMemo) {
            this.dataService.selectedTemplateType = RatingTemplate.ArfRcm;
        } else if (this.case.caseDataReference.actionRequestForm) {
            this.dataService.selectedTemplateType = RatingTemplate.Arf;
        } else {
            this.dataService.selectedTemplateType = RatingTemplate.Rcm;
        }
    }

    createCommitteeSupport() {
        this.dataService.committeSupportWrapper = this.dataService.committeSupportWrapper.createFromCase(
            this.generateCreateCaseData()
        );
    }

    generateCreateCaseData(): CaseData {
        const { ratingCommitteeInfo, committeeMemoSetup } = this.case.caseDataReference;
        const { conflictCheckId, ...excludeConflictCheckId } = committeeMemoSetup;
        const { expected, ...excludeExpected } = ratingCommitteeInfo;

        const caseData: CaseData = {
            ...this.case.caseDataReference,
            ratingCommitteeInfo: excludeExpected,
            committeeMemoSetup: excludeConflictCheckId
        };
        /*TODO REFACTOR THIS CODE */
        if (this.selectedCaseAction === CasesActions.CreateFromExisting) {
            caseData.pressReleaseDisclosures.purposesOfAction = [];
            caseData.pressReleaseDisclosures.newlyIssuedInstrument = null;
            caseData.pressReleaseDisclosures.ratingActionDueTolookBackReview = null;
            caseData.pressReleaseDisclosures.esgFactorsKeyDrivers = null;
            caseData.pressReleaseDisclosures.relevantESGFactors = [];
            caseData.pressReleaseDisclosures.withdrawalReasons = [];
            caseData.pressReleaseDisclosures.accuRateInformations = [];

            caseData.regulatoryDisclosures.qualityOfInformationQuestion = null;
            caseData.regulatoryDisclosures.qualityOfInformationOptions = [];
            caseData.regulatoryDisclosures.qualityOfInfoUnderReviewOption = null;
            caseData.regulatoryDisclosures.informationDisclosureSFOnly = null;
            caseData.regulatoryDisclosures.reasonForReviewAction = [];

            caseData.committeeMemoSetup.keyFactualElements = [];

            caseData.ratingCommitteeInfo.number = null;
            caseData.ratingCommitteeInfo.closingDate = null;

            caseData.committeeMemoSetup.lgdModelUsed = undefined;
            caseData.committeeMemoSetup.crsCrmVerified = undefined;
            caseData.committeeMemoSetup.insuranceScoreUsed = undefined;

            caseData.caseId = this.dataService.generateCaseId();
        }
        return this.selectedCaseAction === CasesActions.EditCase ? this.case.caseDataReference : caseData;
    }

    clearEntity() {
        this.entityService.clearEntityFamilyData();
        this.entityService.clearSelectedOrgsInCart();
        this.dataService.clearCommitteeSetupPage();
    }

    isRatingCommitteeWorkflowEnabledSOV() {
        return (
            this.case.caseDataReference.ratingGroupTemplate === RatingGroupType.SubSovereign ||
            this.case.caseDataReference.ratingGroupTemplate === RatingGroupType.SovereignBond ||
            this.case.caseDataReference.ratingGroupTemplate === RatingGroupType.SovereignMDB
        );
    }
    isRatingCommitteeWorkflowEnabledFIG() {
        return (
            this.case.caseDataReference.ratingGroupTemplate === RatingGroupType.BankingFinanceSecurities ||
            this.case.caseDataReference.ratingGroupTemplate === RatingGroupType.NonBanking
        );
    }
    isRatingCommitteeWorkflowEnabledCFG() {
        return this.case.caseDataReference.ratingGroupTemplate === RatingGroupType.CFG;
    }

    ngOnDestroy() {
        // Make sure we persist the latest state before destroying the component
        this.persistCurrentState();
        
        this.unSubscribe$.next();
        this.unSubscribe$.complete();
    }

    private createCurrentEntityDictionary() {
        // If we already have a populated dictionary from saved state, respect it
        if (this.isSavedStateProcessed && Object.keys(this.selectedCaseEntityDictionary).length > 0) {
            return;
        }
        
        // Otherwise build from the case data
        for (const entity of this.case.caseDataReference.entities) {
            const debt = entity.debts ?? [];
            const ratingClass = entity.ratingClasses ?? [];
            this.buildDictionary(entity.id, ratingClass, RatingRecommendationTableView.Class);
            this.buildDictionary(entity.id, debt, RatingRecommendationTableView.Debt);
        }
        
        // Persist this initial state
        this.persistCurrentState();
    }

    private buildDictionary<T extends { ratings: Rating[]; id: string }>(
        entityId: string,
        ratings: T[],
        ratingType: RatingRecommendationTableView
    ): void {
        for (const parentRating of ratings) {
            for (const rating of parentRating.ratings) {
                const key =
                    ratingType === RatingRecommendationTableView.Class
                        ? generateKey(entityId, rating.identifier)
                        : generateKey(entityId, parentRating.id, rating.identifier);
                this.selectedCaseEntityDictionary[key] = rating;
            }
        }
    }

    private navigateToInviteesPage() {
        this.contentLoaderService.show();
        this.casesService.router
            .navigateByUrl(`${AppRoutes.CASE}/${this.case.id}/${AppRoutes.RC_INVITEES}`)
            .then(() => {
                this.contentLoaderService.hide();
            });
    }

    propogateSelectedEntities() {
        const selectedEntities: Entity[] = this.getSelectedEntities();
        this.dataService.updateSelectedEntities(selectedEntities);
        this.ratingRecommendationService.setSelectedTemplate(this.dataService.selectedTemplateType);
        this.ratingRecommendationService.setSelectedEntities(selectedEntities);
        
        // Ensure any existing rating state is loaded into the service
        if (Object.keys(this.selectedCaseEntityDictionary).length > 0) {
            this.ratingRecommendationService.preloadRatingSelections(this.selectedCaseEntityDictionary);
        }
    }

    getSelectedEntities(): Entity[] {
        const selectedEntities: Entity[] = [];
        this.entityService.selectedOrgTobeImpacted.forEach((org) =>
            selectedEntities.push(
                new Entity({
                    id: org.id,
                    name: org.name,
                    type: org.type,
                    analysts: org.analysts,
                    rated: org.rated,
                    category: org.category,
                    domicile: org.domicile,
                    productLineDescription: org.productLineDescription
                } as Entity)
            )
        );
        return selectedEntities;
    }
}

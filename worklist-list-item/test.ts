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
import { Subject, catchError, of } from 'rxjs';
import { generateKey, Rating } from '../../../features/rating-recommendation';
import { UltimateParent } from '../../../shared/models/UltimateParent';
import { RatingGroupType } from 'src/app/shared/models/RatingGroupType';
import { UserProfileService } from '../../../shared/services/user-profile-service';
import { TranslateService } from '@ngx-translate/core';
import { UserProfile } from '@app/shared/models/UserProfile';
import { FeatureFlagService } from '@app/shared/services/feature-flag.service';
import { LoggingService } from '@app/shared/services/logging.service';

@Component({
    selector: 'app-worklist-list-item',
    templateUrl: './worklist-list-item.component.html',
    styleUrls: ['./worklist-list-item.component.scss']
})
export class WorklistListItemComponent implements OnInit, OnDestroy {
    @Input() case: Case;
    @Input() menuData: Record<'text', string>[] = [];
    @Input() userProfile: UserProfile;

    modalRef: BlueModalRef;

    modalData: ModalEvent = {
        caseName: '',
        caseId: '',
        event: null
    };

    @Output() caseEvent = new EventEmitter<ModalEvent>();

    selectedCaseAction?: CasesActions;

    private readonly unSubscribe$ = new Subject<void>();

    readonly actionRoutes: Record<string, AppRoutes> = {
        [CasesActions.CreateFromExisting]: AppRoutes.SELECT_RATING_GROUP_AND_TEMPLATE,
        [CasesActions.EditCase]: AppRoutes.ENTITY_SELECTION
    };

    readonly ratingGroupWithNoFamilyTree: Record<RatingGroupType.SFGPrimary | RatingGroupType.SFGCoveredBonds, boolean> = {
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
    showRatingRecommendationOption = false;
    
    constructor(
        private dataService: DataService,
        private router: Router,
        private entityService: EntityService,
        private ratingRecommendationService: RatingRecommendationService,
        public casesService: CasesService,
        private contentLoaderService: ContentLoaderService,
        private userProfileService: UserProfileService,
        public translate: TranslateService,
        public featureFlagService: FeatureFlagService,
        private loggingService: LoggingService
    ) {
        this.isCommitteeWorkflow = this.isAnyCommitteeWorkflowEnabled();
    }

    /**
     * Handles opening different modal types based on the menu selection
     * @param value The menu option text that was selected
     */
    openModal(value: string): void {
        switch (value) {
            case 'Rename Case':
                this.modalData = {
                    event: MenuData.rename,
                    caseName: this.case.name,
                    caseId: this.case.id
                };
                this.caseEvent.emit(this.modalData);
                break;
                
            case 'Delete Case':
                this.modalData = {
                    event: MenuData.delete,
                    caseName: '',
                    caseId: this.case.id
                };
                this.caseEvent.emit(this.modalData);
                break;
                
            case 'Create New From Existing':
                this.selectedCaseAction = CasesActions.CreateFromExisting;
                this.ratingRecommendationService.setRatingsTableMode({
                    tableMode: RatingsTableMode.CreateNewRecommendationFromExisting,
                    ratingsDetails: null
                });
                this.goToEntitySelection();
                break;
                
            case 'Rating Committee':
                this.navigateToInviteesPage();
                break;
                
            case 'Authoring':
                this.navigateToAuthoringPage();
                break;
                
            case 'Rating Recommendation':
                this.navigateToRatingRecommendationPage();
                break;
                
            default:
                this.loggingService.warn(`Unhandled menu option: ${value}`);
                break;
        }
    }

    /**
     * Navigate to entity selection for creating new case from existing
     */
    goToEntitySelection(): void {
        this.dataService.createNewFromExisting = true;
        this.case.caseDataReference.id = '';
        this.dataService.isExistingCase = true;
        this.prepareTransition();
    }

    /**
     * Prepare the data for transitioning between views
     */
    prepareTransition(): void {
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

    /**
     * Opens an existing case for editing
     */
    openExistingCase(): void {
        this.createCurrentEntityDictionary();
        this.ratingRecommendationService.setRatingsTableMode({
            tableMode: RatingsTableMode.EditRecommendation,
            ratingsDetails: this.selectedCaseEntityDictionary
        });
        this.selectedCaseAction = CasesActions.EditCase;
        this.dataService.isExistingCase = true;
        this.prepareTransition();
    }

    /**
     * Populates SFG entities and navigates to the appropriate route
     */
    populateSFGEntities(): void {
        this.contentLoaderService.show();
        this.setEntityFamilyList();
        
        this.dataService.manageCaseDetails(
            CaseStatus.Initiated,
            this.dataService.committeSupportWrapper.entities[0]?.name
        );
        
        if (this.selectedCaseAction === CasesActions.EditCase) {
            this.casesService
                .updateCase(this.dataService.committeSupportWrapper)
                .pipe(
                    finalize(() => {
                        this.contentLoaderService.hide();
                        this.router.navigateByUrl(this.actionRoutes[this.selectedCaseAction]);
                    }),
                    takeUntil(this.unSubscribe$)
                )
                .subscribe({
                    error: (err) => this.loggingService.error('Error updating case:', err)
                });
        } else {
            this.contentLoaderService.hide();
            this.router.navigateByUrl(this.actionRoutes[this.selectedCaseAction]);
        }
    }

    /**
     * Populates entity for basket and navigates to the appropriate route
     */
    populateEntityForBasket(): void {
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
                catchError((error) => {
                    this.loggingService.error('Error creating case:', error);
                    return of(null);
                }),
                finalize(() => {
                    this.contentLoaderService.hide();
                    if (this.actionRoutes[this.selectedCaseAction]) {
                        this.router.navigateByUrl(this.actionRoutes[this.selectedCaseAction]);
                    }
                }),
                takeUntil(this.unSubscribe$)
            )
            .subscribe();
    }

    /**
     * Sets the entity family list for SFG entities
     */
    setEntityFamilyList(): void {
        const entityFamilyNode: EntityFamilyNode[] = [];
        
        this.case.caseDataReference.entities.forEach((element) => {
            const entityFamily = new EntityFamilyNode(element);
            const leadAnalyst = element.analysts?.find((analyst) => analyst.role === AnalystRole.leadAnalyst)?.analyst;
            
            if (leadAnalyst) {
                entityFamily.leadAnalyst?.push(leadAnalyst);
            }
            
            entityFamilyNode.push(entityFamily);
        });
        
        this.entityService.addOrgToImpactedList(entityFamilyNode, true);
    }

    /**
     * Sets the ultimate parent entity
     * @param ultimateParentEntity Array of ultimate parent entities
     */
    setUltimateParent(ultimateParentEntity: UltimateParent[]): void {
        const entityFamilyNode: EntityFamilyNode[] = [];
        
        this.case.caseDataReference.entities.forEach((selectedEntity) => {
            const entityFamily = new EntityFamilyNode(selectedEntity);
            const currentUltimateParentEntity = ultimateParentEntity.find((parent) => selectedEntity.id === parent.id);

            if (!currentUltimateParentEntity) {
                this.loggingService.warn(`No ultimate parent found for entity: ${selectedEntity.id}`);
                return;
            }
            
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
            )?.analyst;
            
            if (leadAnalyst) {
                entityFamily.leadAnalyst?.push(leadAnalyst);
            }
            
            entityFamilyNode.push(entityFamily);
        });
        
        this.entityService.addOrgToImpactedList(entityFamilyNode, true);
    }

    /**
     * Selects the template type based on case data
     */
    selectTemplateType(): void {
        const { actionRequestForm, ratingCommitteeMemo } = this.case.caseDataReference;
        
        if (actionRequestForm && ratingCommitteeMemo) {
            this.dataService.selectedTemplateType = RatingTemplate.ArfRcm;
        } else if (actionRequestForm) {
            this.dataService.selectedTemplateType = RatingTemplate.Arf;
        } else {
            this.dataService.selectedTemplateType = RatingTemplate.Rcm;
        }
    }

    /**
     * Creates committee support data structure
     */
    createCommitteeSupport(): void {
        this.dataService.committeSupportWrapper = this.dataService.committeSupportWrapper.createFromCase(
            this.generateCreateCaseData()
        );
    }

    /**
     * Generates case data for creating or editing a case
     * @returns The generated case data
     */
    generateCreateCaseData(): CaseData {
        const { ratingCommitteeInfo, committeeMemoSetup } = this.case.caseDataReference;
        const { conflictCheckId, ...excludeConflictCheckId } = committeeMemoSetup;
        const { expected, ...excludeExpected } = ratingCommitteeInfo;

        const caseData: CaseData = {
            ...this.case.caseDataReference,
            ratingCommitteeInfo: excludeExpected,
            committeeMemoSetup: excludeConflictCheckId,
        };
        
        if (this.selectedCaseAction === CasesActions.CreateFromExisting) {
            // Reset specific fields for new case creation
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

    /**
     * Clears entity data
     */
    clearEntity(): void {
        this.entityService.clearEntityFamilyData();
        this.entityService.clearSelectedOrgsInCart();
        this.dataService.clearCommitteeSetupPage();
    }

    /**
     * Angular lifecycle hook - component initialization
     */
    ngOnInit(): void {
        // Check if any entity has proposed ratings
        const hasProposedRating = this.case.caseDataReference?.entities?.some((entity) =>
            entity.ratingClasses?.some((ratingClass) =>
                ratingClass.ratings?.some((rating) => rating.proposedRating !== undefined)
            )
        );

        // Check if rating committee workflow is enabled for this case
        const isRatingCommitteeWorkflow = this.isRatingCommitteeWorkflowEnabled();
        
        // Set case properties based on conditions
        this.case.showAuthoring =
            hasProposedRating && isRatingCommitteeWorkflow && !!this.case.caseDataReference.ratingCommitteeMemo;

        // Check if case is saved using any of the available indicators
        const isSavedCase = 
            this.ratingRecommendationService.isCaseSaved(this.case.id) || 
            this.case.caseDataReference?.status !== CaseStatus.Initiated || 
            !!this.case.caseDataReference?.lastSaveAndDownloadDate;

        // Set visibility flags
        this.case.showRatingRecommendation = hasProposedRating;
        this.showRatingRecommendationOption = hasProposedRating && isSavedCase;
    }

    /**
     * Checks if any committee workflow is enabled
     * @returns True if any committee workflow is enabled
     */
    private isAnyCommitteeWorkflowEnabled(): boolean {
        return this.featureFlagService.isCommitteeWorkflowEnabled() ||
               this.featureFlagService.isCommitteeWorkflowEnabledFIG() ||
               this.featureFlagService.isCommitteeWorkflowEnabledCFG();
    }

    /**
     * Checks if rating committee workflow is enabled for the current case
     * @returns True if rating committee workflow is enabled
     */
    private isRatingCommitteeWorkflowEnabled(): boolean {
        return (
            (this.featureFlagService.isCommitteeWorkflowEnabled() && this.isRatingCommitteeWorkflowEnabledSOV()) ||
            (this.featureFlagService.isCommitteeWorkflowEnabledFIG() && this.isRatingCommitteeWorkflowEnabledFIG()) ||
            (this.featureFlagService.isCommitteeWorkflowEnabledCFG() && this.isRatingCommitteeWorkflowEnabledCFG())
        );
    }

    /**
     * Checks if SOV rating committee workflow is enabled
     * @returns True if SOV rating committee workflow is enabled
     */
    private isRatingCommitteeWorkflowEnabledSOV(): boolean {
        const ratingGroupTemplate = this.case.caseDataReference.ratingGroupTemplate;
        return [
            RatingGroupType.SubSovereign,
            RatingGroupType.SovereignBond,
            RatingGroupType.SovereignMDB
        ].includes(ratingGroupTemplate);
    }
    
    /**
     * Checks if FIG rating committee workflow is enabled
     * @returns True if FIG rating committee workflow is enabled
     */
    private isRatingCommitteeWorkflowEnabledFIG(): boolean {
        const ratingGroupTemplate = this.case.caseDataReference.ratingGroupTemplate;
        return [
            RatingGroupType.BankingFinanceSecurities,
            RatingGroupType.NonBanking
        ].includes(ratingGroupTemplate);
    }
    
    /**
     * Checks if CFG rating committee workflow is enabled
     * @returns True if CFG rating committee workflow is enabled
     */
    private isRatingCommitteeWorkflowEnabledCFG(): boolean {
        return this.case.caseDataReference.ratingGroupTemplate === RatingGroupType.CFG;
    }

    /**
     * Angular lifecycle hook - component destruction
     */
    ngOnDestroy(): void {
        this.unSubscribe$.next();
        this.unSubscribe$.complete();
    }

    /**
     * Creates a dictionary of ratings from case data
     */
    private createCurrentEntityDictionary(): void {
        // Clear existing dictionary before rebuilding
        this.selectedCaseEntityDictionary = {};
        
        // Ensure entities exist before processing
        if (!this.case.caseDataReference?.entities || !Array.isArray(this.case.caseDataReference.entities)) {
            this.loggingService.warn('No entities found in case data reference');
            return;
        }
        
        this.loggingService.debug(`Processing ${this.case.caseDataReference.entities.length} entities for dictionary`);
        
        for (const entity of this.case.caseDataReference.entities) {
            // Skip if entity doesn't have an ID
            if (!entity.id) {
                this.loggingService.warn('Entity without ID found, skipping');
                continue;
            }
            
            const debt = entity.debts ?? [];
            const ratingClass = entity.ratingClasses ?? [];
            
            // Process rating classes and debts
            this.buildDictionary(entity.id, ratingClass, RatingRecommendationTableView.Class);
            this.buildDictionary(entity.id, debt, RatingRecommendationTableView.Debt);
        }
        
        this.loggingService.debug(`Dictionary created with ${Object.keys(this.selectedCaseEntityDictionary).length} entries`);
    }

    /**
     * Builds dictionary entries for ratings
     * @param entityId The entity ID
     * @param items Array of items with ratings
     * @param ratingType The rating type (Class or Debt)
     */
    private buildDictionary<T extends { ratings?: Rating[]; id: string }>(
        entityId: string,
        items: T[],
        ratingType: RatingRecommendationTableView
    ): void {
        if (!items || !Array.isArray(items) || items.length === 0) {
            return;
        }
        
        for (const item of items) {
            // Skip if item doesn't have ratings or ID
            if (!item.ratings || !Array.isArray(item.ratings) || !item.id) {
                continue;
            }
            
            for (const rating of item.ratings) {
                // Skip if rating or identifier is missing
                if (!rating || !rating.identifier) {
                    continue;
                }
                
                // Generate appropriate key based on rating type
                const key = ratingType === RatingRecommendationTableView.Class
                    ? generateKey(entityId, rating.identifier)
                    : generateKey(entityId, item.id, rating.identifier);
                
                // Store rating in dictionary
                this.selectedCaseEntityDictionary[key] = { ...rating };
            }
        }
    }

    /**
     * Navigates to the invitees page for the current case
     */
    private navigateToInviteesPage(): void {
        this.contentLoaderService.show();
        const url = `${AppRoutes.CASE}/${this.case.id}/${AppRoutes.RC_INVITEES}`;
        const urlSegments = url.split('/').filter(segment => segment);
        
        this.router.navigate(urlSegments)
            .then(() => {
                this.contentLoaderService.hide();
            })
            .catch(error => {
                this.loggingService.error('Navigation error:', error);
                this.contentLoaderService.hide();
                window.location.href = url;
            });
    }

    /**
     * Navigates to the authoring page for the current case
     */
    private navigateToAuthoringPage(): void {
        this.contentLoaderService.show();
        const url = `${AppRoutes.CASE}/${this.case.id}/${AppRoutes.EXECUTIVE_SUMMARY}`;
        const urlSegments = url.split('/').filter(segment => segment);
        
        this.router.navigate(urlSegments)
            .then(() => {
                this.contentLoaderService.hide();
            })
            .catch(error => {
                this.loggingService.error('Navigation error:', error);
                this.contentLoaderService.hide();
                window.location.href = url;
            });
    }

    /**
     * Navigates to the rating recommendation page for the current case
     */
    private navigateToRatingRecommendationPage(): void {
        // Show the content loader before starting any work
        this.contentLoaderService.show();
        
        try {
            // Step 1: Create the entity dictionary
            this.createCurrentEntityDictionary();
            
            // Step 2: Set the table mode
            this.ratingRecommendationService.setRatingsTableMode({
                tableMode: RatingsTableMode.EditRecommendation,
                ratingsDetails: this.selectedCaseEntityDictionary
            });
            
            // Step 3: Set data service flags
            this.dataService.isExistingCase = true;
            
            // Step 4: Create committee support wrapper if it doesn't exist
            if (!this.dataService.committeSupportWrapper) {
                this.loggingService.debug('Creating new committee support wrapper');
                this.dataService.initializeCommitteeSupportWrapper();
            }
            
            // Step 5: Set up the committee support data
            this.createCommitteeSupport();
            
            // Step 6: Mark as having rating recommendation
            this.dataService.committeSupportWrapper.hasRatingRecommendation = true;
            
            // Step 7: Prepare case data for navigation
            this.casesService.getCaseById(this.case.id)
                .pipe(
                    // Handle potential errors to prevent navigation failures
                    catchError(error => {
                        this.loggingService.error('Error fetching case data:', error);
                        return of(this.case);
                    }),
                    // Use a finalize to ensure content loader is hidden even if there's an error
                    finalize(() => {
                        this.contentLoaderService.hide();
                    }),
                    // Clean up the subscription
                    takeUntil(this.unSubscribe$)
                )
                .subscribe(() => {
                    // Step 8: Navigate with proper route parameters
                    const url = `${AppRoutes.CASE}/${this.case.id}/${AppRoutes.RATING_RECOMMENDATION}`;
                    const urlSegments = url.split('/').filter(segment => segment);
                    
                    // Attempt to use the Angular router first
                    this.router.navigate(urlSegments)
                        .then(() => {
                            this.loggingService.debug('Successfully navigated to Rating Recommendation');
                        })
                        .catch(error => {
                            this.loggingService.error('Router navigation failed:', error);
                            
                            // Fall back to direct navigation as a last resort
                            window.location.href = url;
                        });
                });
        } catch (error) {
            this.loggingService.error('Error preparing for navigation:', error);
            this.contentLoaderService.hide();
            
            // Simple fallback if something goes catastrophically wrong
            alert('An error occurred while preparing to navigate. Please try again.');
        }
    }
}

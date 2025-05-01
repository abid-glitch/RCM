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
import { Subject } from 'rxjs';
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
    unSubscribe$ = new Subject<void>();

    actionRoutes: Record<string, AppRoutes> = {
        [CasesActions.CreateFromExisting]: AppRoutes.SELECT_RATING_GROUP_AND_TEMPLATE,
        [CasesActions.EditCase]: AppRoutes.ENTITY_SELECTION
    };

    ratingGroupWithNoFamilyTree: Record<string, boolean> = {
        [RatingGroupType.SFGCoveredBonds]: true,
        [RatingGroupType.SFGPrimary]: true
    };

    selectedCaseEntityDictionary: Record<string, Rating> = {};
    @ViewChild(BluePopoverAnchor) bluePopOverElement: BluePopoverAnchor;

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
        public featureFlagService: FeatureFlagService
    ) {
        this.isCommitteeWorkflow =
            this.featureFlagService.isCommitteeWorkflowEnabled() ||
            this.featureFlagService.isCommitteeWorkflowEnabledFIG() ||
            this.featureFlagService.isCommitteeWorkflowEnabledCFG();
    }

    ngOnInit() {
        const hasProposedRating = this.case?.caseDataReference?.entities?.some((entity) =>
            entity.ratingClasses?.some((ratingClass) =>
                ratingClass.ratings?.some((rating) => rating.proposedRating !== undefined)
            )
        );
        
        const isRatingCommitteeWorkflow =
            (this.featureFlagService.isCommitteeWorkflowEnabled() && this.isRatingCommitteeWorkflowEnabledSOV()) ||
            (this.featureFlagService.isCommitteeWorkflowEnabledFIG() && this.isRatingCommitteeWorkflowEnabledFIG()) ||
            (this.featureFlagService.isCommitteeWorkflowEnabledCFG() && this.isRatingCommitteeWorkflowEnabledCFG());
            
        if (this.case && this.case.caseDataReference) {
            this.case.showAuthoring =
                hasProposedRating && isRatingCommitteeWorkflow && this.case.caseDataReference.ratingCommitteeMemo;
        }
    }

    ngOnDestroy() {
        this.unSubscribe$.next();
        this.unSubscribe$.complete();
    }

    openModal(value: string) {
        if (!value || !this.case) {
            return;
        }

        switch (value) {
            case 'Rename Case':
                this.handleRenameCase();
                break;
            case 'Delete Case':
                this.handleDeleteCase();
                break;
            case 'Create New From Existing':
                this.handleCreateNewFromExisting();
                break;
            case 'Rating Committee':
                this.navigateToInviteesPage();
                break;
            case 'Authoring':
                this.navigateToAuthoringPage();
                break;
            case 'Rating Recommendation':
                this.navigateToRatingRecommendation();
                break;
            default:
                break;
        }
    }

    private handleRenameCase(): void {
        this.modalData.event = MenuData.rename;
        this.modalData.caseName = this.case.name;
        this.modalData.caseId = this.case.id;
        this.caseEvent.emit({ ...this.modalData });
    }

    private handleDeleteCase(): void {
        this.modalData.event = MenuData.delete;
        this.modalData.caseId = this.case.id;
        this.caseEvent.emit({ ...this.modalData });
    }

    private handleCreateNewFromExisting(): void {
        this.selectedCaseAction = CasesActions.CreateFromExisting;
        this.ratingRecommendationService.setRatingsTableMode({
            tableMode: RatingsTableMode.CreateNewRecommendationFromExisting,
            ratingsDetails: null
        });
        this.goToEntitySelection();
    }

    navigateToRatingRecommendation(): void {
        this.contentLoaderService.show();
        
        try {
            // Create entity dictionary for passing data
            this.createCurrentEntityDictionary();
            
            // Set table mode with entity data
            this.ratingRecommendationService.setRatingsTableMode({
                tableMode: RatingsTableMode.EditRecommendation,
                ratingsDetails: this.selectedCaseEntityDictionary
            });
            
            // Set data service case data
            this.dataService.isExistingCase = true;
            
            // Navigate to rating recommendation page with case ID in route
            const casePath = `${AppRoutes.CASE}/${this.case.id}/${AppRoutes.RATING_RECOMMENDATION}`;
            this.router.navigateByUrl(casePath)
                .finally(() => {
                    this.contentLoaderService.hide();
                });
        } catch (error) {
            console.error('Error navigating to rating recommendation:', error);
            this.contentLoaderService.hide();
        }
    }

    goToEntitySelection(): void {
        if (this.case && this.case.caseDataReference) {
            this.dataService.createNewFromExisting = true;
            this.case.caseDataReference.id = '';
            this.dataService.isExistingCase = true;
            this.prepareTransition();
        }
    }

    prepareTransition(): void {
        this.clearEntity();
        this.createCommitteeSupport();
        
        if (this.dataService.committeSupportWrapper) {
            this.dataService.updateRatingGroupSelection(this.dataService.committeSupportWrapper.ratingGroupTemplate);
            this.dataService.setSelectedJurisdiction();
            this.selectTemplateType();
            
            if (this.ratingGroupWithNoFamilyTree[this.dataService.committeSupportWrapper.ratingGroupTemplate]) {
                this.populateSFGEntities();
            } else {
                this.populateEntityForBasket();
            }
        }
    }

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

    populateSFGEntities(): void {
        this.contentLoaderService.show();
        this.setEntityFamilyList();
        
        if (this.dataService.committeSupportWrapper && this.dataService.committeSupportWrapper.entities 
            && this.dataService.committeSupportWrapper.entities.length > 0) {
            
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
                        if (this.selectedCaseAction && this.actionRoutes[this.selectedCaseAction]) {
                            this.router.navigateByUrl(this.actionRoutes[this.selectedCaseAction]);
                        }
                    }),
                    takeUntil(this.unSubscribe$)
                )
                .subscribe();
        } else {
            this.contentLoaderService.hide();
        }
    }

    populateEntityForBasket(): void {
        if (!this.case || !this.case.caseDataReference || !this.case.caseDataReference.entities) {
            this.contentLoaderService.hide();
            return;
        }
        
        this.contentLoaderService.show();
        this.entityService
            .getUltimateParents(this.case.caseDataReference.entities)
            .pipe(
                tap((ultimateParentEntity) => this.setUltimateParent(ultimateParentEntity)),
                filter(() => this.selectedCaseAction === CasesActions.CreateFromExisting),
                switchMap(() => {
                    const entityName = this.entityService.selectedOrgTobeImpacted && 
                                      this.entityService.selectedOrgTobeImpacted.length > 0 ?
                                      this.entityService.selectedOrgTobeImpacted[0]?.name : '';
                    return this.dataService.manageCaseDetails(
                        CaseStatus.Initiated,
                        entityName
                    );
                }),
                concatMap((committeeSupportWrapper) => this.casesService.createCase(committeeSupportWrapper)),
                tap((caseResp) => {
                    if (caseResp && caseResp.id) {
                        this.dataService.setCaseId(caseResp.id);
                    }
                }),
                finalize(() => {
                    this.contentLoaderService.hide();
                    if (this.selectedCaseAction && this.actionRoutes[this.selectedCaseAction]) {
                        this.router.navigateByUrl(this.actionRoutes[this.selectedCaseAction]);
                    }
                }),
                takeUntil(this.unSubscribe$)
            )
            .subscribe();
    }

    setEntityFamilyList(): void {
        if (!this.case || !this.case.caseDataReference || !this.case.caseDataReference.entities) {
            return;
        }
        
        const entityFamilyNode: EntityFamilyNode[] = [];
        
        this.case.caseDataReference.entities.forEach((element) => {
            if (element) {
                const entityFamily = new EntityFamilyNode(element);
                const leadAnalyst = element.analysts?.find(
                    (analyst) => analyst && analyst.role === AnalystRole.leadAnalyst
                )?.analyst;
                
                if (leadAnalyst) {
                    entityFamily.leadAnalyst = entityFamily.leadAnalyst || [];
                    entityFamily.leadAnalyst.push(leadAnalyst);
                }
                
                entityFamilyNode.push(entityFamily);
            }
        });
        
        this.entityService.addOrgToImpactedList(entityFamilyNode, true);
    }

    setUltimateParent(ultimateParentEntity: UltimateParent[]): void {
        if (!this.case || !this.case.caseDataReference || !this.case.caseDataReference.entities 
            || !ultimateParentEntity) {
            return;
        }
        
        const entityFamilyNode: EntityFamilyNode[] = [];
        
        this.case.caseDataReference.entities.forEach((selectedEntity) => {
            if (!selectedEntity) return;
            
            const entityFamily = new EntityFamilyNode(selectedEntity);
            const currentUltimateParentEntity = ultimateParentEntity.find(
                (parent) => parent && selectedEntity.id === parent.id
            );

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
                (analyst) => analyst && analyst.role === AnalystRole.leadAnalyst
            )?.analyst;
            
            if (leadAnalyst) {
                entityFamily.leadAnalyst = entityFamily.leadAnalyst || [];
                entityFamily.leadAnalyst.push(leadAnalyst);
            }
            
            entityFamilyNode.push(entityFamily);
        });
        
        this.entityService.addOrgToImpactedList(entityFamilyNode, true);
    }

    selectTemplateType(): void {
        if (!this.case || !this.case.caseDataReference) {
            return;
        }
        
        if (this.case.caseDataReference.actionRequestForm && this.case.caseDataReference.ratingCommitteeMemo) {
            this.dataService.selectedTemplateType = RatingTemplate.ArfRcm;
        } else if (this.case.caseDataReference.actionRequestForm) {
            this.dataService.selectedTemplateType = RatingTemplate.Arf;
        } else {
            this.dataService.selectedTemplateType = RatingTemplate.Rcm;
        }
    }

    createCommitteeSupport(): void {
        if (this.dataService.committeSupportWrapper && this.case) {
            const caseData = this.generateCreateCaseData();
            this.dataService.committeSupportWrapper = this.dataService.committeSupportWrapper.createFromCase(caseData);
        }
    }

    generateCreateCaseData(): CaseData {
        if (!this.case || !this.case.caseDataReference) {
            return null;
        }
        
        const { ratingCommitteeInfo, committeeMemoSetup } = this.case.caseDataReference;
        
        // Handle potential nulls
        const conflictCheckId = committeeMemoSetup?.conflictCheckId;
        const committeeMemoSetupObj = committeeMemoSetup ? { ...committeeMemoSetup } : {};
        if (committeeMemoSetupObj.conflictCheckId !== undefined) {
            delete committeeMemoSetupObj.conflictCheckId;
        }
        
        const expected = ratingCommitteeInfo?.expected;
        const ratingCommitteeInfoObj = ratingCommitteeInfo ? { ...ratingCommitteeInfo } : {};
        if (ratingCommitteeInfoObj.expected !== undefined) {
            delete ratingCommitteeInfoObj.expected;
        }

        const caseData: CaseData = {
            ...this.case.caseDataReference,
            ratingCommitteeInfo: ratingCommitteeInfoObj,
            committeeMemoSetup: committeeMemoSetupObj
        };
        
        if (this.selectedCaseAction === CasesActions.CreateFromExisting) {
            // Initialize objects if they don't exist
            caseData.pressReleaseDisclosures = caseData.pressReleaseDisclosures || {};
            caseData.regulatoryDisclosures = caseData.regulatoryDisclosures || {};
            caseData.committeeMemoSetup = caseData.committeeMemoSetup || {};
            caseData.ratingCommitteeInfo = caseData.ratingCommitteeInfo || {};
            
            // Reset arrays
            caseData.pressReleaseDisclosures.purposesOfAction = [];
            caseData.pressReleaseDisclosures.relevantESGFactors = [];
            caseData.pressReleaseDisclosures.withdrawalReasons = [];
            caseData.pressReleaseDisclosures.accuRateInformations = [];
            
            caseData.regulatoryDisclosures.qualityOfInformationOptions = [];
            caseData.regulatoryDisclosures.reasonForReviewAction = [];
            
            caseData.committeeMemoSetup.keyFactualElements = [];
            
            // Reset primitive values
            caseData.pressReleaseDisclosures.newlyIssuedInstrument = null;
            caseData.pressReleaseDisclosures.ratingActionDueTolookBackReview = null;
            caseData.pressReleaseDisclosures.esgFactorsKeyDrivers = null;
            
            caseData.regulatoryDisclosures.qualityOfInformationQuestion = null;
            caseData.regulatoryDisclosures.qualityOfInfoUnderReviewOption = null;
            caseData.regulatoryDisclosures.informationDisclosureSFOnly = null;
            
            caseData.ratingCommitteeInfo.number = null;
            caseData.ratingCommitteeInfo.closingDate = null;
            
            caseData.committeeMemoSetup.lgdModelUsed = undefined;
            caseData.committeeMemoSetup.crsCrmVerified = undefined;
            caseData.committeeMemoSetup.insuranceScoreUsed = undefined;
            
            caseData.caseId = this.dataService.generateCaseId();
        }
        
        return this.selectedCaseAction === CasesActions.EditCase ? 
            this.case.caseDataReference : caseData;
    }

    clearEntity(): void {
        this.entityService.clearEntityFamilyData();
        this.entityService.clearSelectedOrgsInCart();
        this.dataService.clearCommitteeSetupPage();
    }

    isRatingCommitteeWorkflowEnabledSOV(): boolean {
        if (!this.case || !this.case.caseDataReference) {
            return false;
        }
        
        return (
            this.case.caseDataReference.ratingGroupTemplate === RatingGroupType.SubSovereign ||
            this.case.caseDataReference.ratingGroupTemplate === RatingGroupType.SovereignBond ||
            this.case.caseDataReference.ratingGroupTemplate === RatingGroupType.SovereignMDB
        );
    }
    
    isRatingCommitteeWorkflowEnabledFIG(): boolean {
        if (!this.case || !this.case.caseDataReference) {
            return false;
        }
        
        return (
            this.case.caseDataReference.ratingGroupTemplate === RatingGroupType.BankingFinanceSecurities ||
            this.case.caseDataReference.ratingGroupTemplate === RatingGroupType.NonBanking
        );
    }
    
    isRatingCommitteeWorkflowEnabledCFG(): boolean {
        if (!this.case || !this.case.caseDataReference) {
            return false;
        }
        
        return this.case.caseDataReference.ratingGroupTemplate === RatingGroupType.CFG;
    }

    private createCurrentEntityDictionary(): void {
        if (!this.case || !this.case.caseDataReference || !this.case.caseDataReference.entities) {
            return;
        }
        
        this.selectedCaseEntityDictionary = {};
        
        for (const entity of this.case.caseDataReference.entities) {
            if (!entity) continue;
            
            const debt = entity.debts || [];
            const ratingClass = entity.ratingClasses || [];
            
            this.buildDictionary(entity.id, ratingClass, RatingRecommendationTableView.Class);
            this.buildDictionary(entity.id, debt, RatingRecommendationTableView.Debt);
        }
    }

    private buildDictionary<T extends { ratings?: Rating[]; id: string }>(
        entityId: string,
        ratings: T[],
        ratingType: RatingRecommendationTableView
    ): void {
        if (!ratings || !entityId) return;
        
        for (const parentRating of ratings) {
            if (!parentRating || !parentRating.ratings) continue;
            
            for (const rating of parentRating.ratings) {
                if (!rating || !rating.identifier) continue;
                
                const key = ratingType === RatingRecommendationTableView.Class
                    ? generateKey(entityId, rating.identifier)
                    : generateKey(entityId, parentRating.id, rating.identifier);
                    
                this.selectedCaseEntityDictionary[key] = rating;
            }
        }
    }

    private navigateToInviteesPage(): void {
        if (!this.case || !this.case.id) return;
        
        this.contentLoaderService.show();
        const path = `${AppRoutes.CASE}/${this.case.id}/${AppRoutes.RC_INVITEES}`;
        
        this.router.navigateByUrl(path)
            .finally(() => {
                this.contentLoaderService.hide();
            });
    }

    private navigateToAuthoringPage(): void {
        if (!this.case || !this.case.id) return;
        
        this.contentLoaderService.show();
        const path = `${AppRoutes.CASE}/${this.case.id}/${AppRoutes.EXECUTIVE_SUMMARY}`;
        
        this.router.navigateByUrl(path)
            .finally(() => {
                this.contentLoaderService.hide();
            });
    }
}

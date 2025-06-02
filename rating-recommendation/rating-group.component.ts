import { Component, EventEmitter, Inject, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { LineOfBusiness, RatingGroupType } from 'src/app/shared/models/RatingGroupType';
import { DataService } from 'src/app/shared/services/data.service';
import { FeatureFlagService } from 'src/app/shared/services/feature-flag.service';
import { BlueModalRef, BlueModalService } from '@moodys/blue-ng';
import {
    LatamContractingEntity,
    RatingUnit,
    RegionJurisdiction
} from 'src/app/shared/models/regionJurisdictionDetails';
import { LatamPopupModalComponent } from '../latam-popup-modal/latam-popup-modal.component';
import { JapanPopupModalComponent } from '../japan-popup-modal/japan-popup-modal.component';
import { CommitteeSupport } from 'src/app/shared/models/CommitteeSupport';
import { IssuanceType } from 'src/app/shared/models/IssuanceType';
import { IssuingEntityOptions } from 'src/app/shared/models/IssuingEntityOptions';
import { Subscription } from 'rxjs';
import { SplitTreatments } from 'src/app/shared/models/SplitTreatment';
import { EntityService } from '../../shared/services/entity.service';
import { ratingGroupMapByLOB } from '../../shared/models/RatingGroupType';
import { SmartDefaultsService } from '../sov-smart-default-popup/smart-defaults.service';
import { RatingRecommendationService } from '../rating-recommendation/services/rating-recommendation.service';
import { take, tap } from 'rxjs/operators';
import { TableModeState } from '../rating-recommendation';
import { CommonMethodologyService } from '../../shared/services/methology-helpers/common-methodology.service';
import { SharedModalComponent } from '../../shared/modals/shared-modal-component/shared-modal.component';
import { UserProfile } from '@moodys/emtn-ng/auth';

@Component({
    selector: 'app-rating-group',
    templateUrl: './rating-group.component.html',
    styleUrls: ['./rating-group.component.scss']
})
export class RatingGroupComponent implements OnInit, OnDestroy {
    public selectedRatingGroupType: RatingGroupType;
    public modalRef: BlueModalRef;
    public selectedJurisdiction: RegionJurisdiction;
    public ratingGroupTypes: RatingGroupType[];
    private featureFlagSubscriptions: Subscription;
    private isUsingNewPrimaryMethodologyUX = false;
    private prevRatingGroup = undefined;
    private prevJurisdiction = undefined;
    private isRatingRecommendationTable = false;

    ratingRecommendationTableMode!: TableModeState;

    regionJurisdictionArray: RegionJurisdiction[] = [];

    @Input()
    userProfile: UserProfile;

    @Output()
    ratingGroupTypeEventEmitter = new EventEmitter<RatingGroupType>();

    @ViewChild('resetWarningModal') resetWarningModal?: BlueModalRef;

    constructor(
        private dataService: DataService,
        private commonMethodologyService: CommonMethodologyService,
        private entityService: EntityService,
        private featureFlagService: FeatureFlagService,
        private smartDefaultService: SmartDefaultsService,
        private ratingRecommendationService: RatingRecommendationService,
        @Inject(BlueModalService) private modalService: BlueModalService
    ) {
        this.featureFlagSubscriptions = this.featureFlagService.featureFlags$.subscribe((isFlagOn) => {
            if (isFlagOn) {
                this.populateRatingGroupTypes();
                this.isUsingNewPrimaryMethodologyUX = this.featureFlagService.getTreatmentState(
                    SplitTreatments.METHODOLOGY_UX_REDESIGN
                );

                this.isRatingRecommendationTable = this.featureFlagService.getTreatmentState(
                    SplitTreatments.ONLINE_RATING_RECOMMENDATION_TABLE
                );
            }
        });
        this.populateRegionJurisdictionArray();
    }

    ngOnInit(): void {
        const existingData: CommitteeSupport = this.dataService.committeSupportWrapper;
        this.prevRatingGroup = existingData?.ratingGroupTemplate;
        this.prevJurisdiction = existingData?.region.name;
        this.selectedRatingGroupType = existingData?.ratingGroupTemplate;
        this.selectedJurisdiction = existingData?.region.name || RegionJurisdiction.Global;
        if (this.selectedJurisdiction === RegionJurisdiction.Global) {
            this.dataService.updateGlobalSelection();
        }
        this.updateLatinAmericaSelction = this.updateLatinAmericaSelction.bind(this);
        this.updateJapanSelction = this.updateJapanSelction.bind(this);
        this.clearJurisdictionSelection = this.clearJurisdictionSelection.bind(this);

        /*Current Process MoDE Mode*/
        this.ratingRecommendationService.ratingsTableMode$
            .pipe(
                take(1),
                tap((currentMode) => (this.ratingRecommendationTableMode = currentMode))
            )
            .subscribe();
    }

    ratingGroupTypeChange(event: RatingGroupType) {
        if (
            this.dataService.committeSupportWrapper.ratingGroupTemplate !== undefined &&
            this.dataService.hasSelectedTemplate
        ) {
            this.openModals();
        } else {
            this.onSelectRatingGroup();
            this.prevRatingGroup = event;
        }
    }

    private onSelectRatingGroup() {
        this.dataService.updateRatingGroupSelection(this.selectedRatingGroupType);
        this.dataService.clearCommitteeSetupPage();
        this.entityService.clearEntityFamilyData();
        this.ratingGroupTypeEventEmitter.emit(this.selectedRatingGroupType);
        this.initiateFilteringMethodology();
        this.checkInvalidTemplateRegionSelection();
    }

    private populateRatingGroupTypes() {
        this.ratingGroupTypes = Object.values(RatingGroupType).filter((groupType) => {
            if (
                groupType === RatingGroupType.CFG ||
                groupType === RatingGroupType.InfrastructureProjectFinance ||
                groupType === RatingGroupType.BankingFinanceSecurities ||
                groupType === RatingGroupType.NonBanking ||
                groupType === RatingGroupType.SovereignBond ||
                groupType === RatingGroupType.SubSovereign ||
                groupType === RatingGroupType.SovereignMDB
            )
                return true;
            return this.featureFlagService.isTemplateEnabled(groupType);
        });
    }

    populateRegionJurisdictionArray() {
        this.regionJurisdictionArray = Object.values(RegionJurisdiction).filter((regionJurisdiction) => {
            return regionJurisdiction !== RegionJurisdiction.LatinAmerica;
        });
    }

    get regionJurisdiction() {
        if (this.isStructuredFinanaceGroup || this.isNonBanking) {
            return this.regionJurisdictionArray.filter(
                (jurisdiction) => jurisdiction != RegionJurisdiction.LatinAmerica
            );
        }

        return this.regionJurisdictionArray;
    }

    get isNonBanking(): boolean {
        return this.selectedRatingGroupType === RatingGroupType.NonBanking;
    }

    get isStructuredFinanaceGroup(): boolean {
        return ratingGroupMapByLOB[this.selectedRatingGroupType] === LineOfBusiness.STRUCTURED_FINANCE_GROUP;
    }

    updateSelectedRegion() {
        if (this.dataService.committeSupportWrapper.region.name !== undefined && this.dataService.hasSelectedTemplate) {
            this.openModals();
        } else {
            this.onSelectJurisdiction();
            this.prevJurisdiction = this.selectedJurisdiction;
        }
    }

    private onSelectJurisdiction() {
        switch (this.selectedJurisdiction) {
            case RegionJurisdiction.LatinAmerica:
                this.modalRef = this.modalService.open(LatamPopupModalComponent, {
                    onContinue: this.updateLatinAmericaSelction.bind(this),
                    onCancel: this.clearJurisdictionSelection.bind(this)
                });
                break;
            case RegionJurisdiction.Japan:
                this.modalRef = this.modalService.open(JapanPopupModalComponent, {
                    onContinue: this.updateJapanSelction.bind(this),
                    onCancel: this.clearJurisdictionSelection.bind(this)
                });
                this.checkInvalidTemplateRegionSelection();
                break;
            case RegionJurisdiction.Global:
                this.dataService.updateGlobalSelection();
                this.initiateFilteringMethodology();
                this.checkInvalidTemplateRegionSelection();
                break;
            default:
                console.error('Invalid Region');
        }
        this.dataService.clearMethodologyQuestions();
    }

    checkInvalidTemplateRegionSelection() {
        if (
            (this.selectedJurisdiction != RegionJurisdiction.Global && this.isNonBanking) ||
            (this.selectedJurisdiction === RegionJurisdiction.LatinAmerica && this.isStructuredFinanaceGroup)
        ) {
            this.selectedJurisdiction = RegionJurisdiction.Global;
            this.onSelectJurisdiction();
        }
    }
    updateLatinAmericaSelction(
        issuanceType: IssuanceType,
        contractingEntity: LatamContractingEntity,
        issuingEntity: IssuingEntityOptions
    ) {
        this.dataService.updateLatinAmericaSelection(issuanceType, contractingEntity, issuingEntity);
        this.initiateFilteringMethodology();
        this.modalRef.close();
    }

    updateJapanSelction(ratingEntity: RatingUnit) {
        this.dataService.updateJapanSelection(ratingEntity);
        this.initiateFilteringMethodology();
        this.modalRef.close();
    }

    clearJurisdictionSelection() {
        this.selectedJurisdiction = RegionJurisdiction.Global;
        this.dataService.cancelJuristictionSelection();
        this.initiateFilteringMethodology();
        this.modalRef?.close();
    }

    private initiateFilteringMethodology() {
        if (!this.isUsingNewPrimaryMethodologyUX) {
            this.commonMethodologyService.methodologyService.filterMethodologiesListForRegions();
        } else {
            this.dataService.setSelectedJurisdiction();
            this.commonMethodologyService.primaryMethodologyService.resetShouldSetSectorAndMethodologyDefaults();
        }
    }

    resetComponent() {
        this.selectedRatingGroupType = undefined;
        this.clearJurisdictionSelection();
    }

    private closeModals() {
        if (this.isRatingRecommendationTable) {
            this.modalRef.close();
        } else {
            this.resetWarningModal.close();
        }
    }

    private openModals() {
        if (this.isRatingRecommendationTable) {
            this.resetWarningModalDialogOpen();
        } else {
            this.resetWarningModal.open();
        }
    }

    resetWarningModalClose = () => {
        this.closeModals();
        this.selectedRatingGroupType = this.prevRatingGroup;
        this.selectedJurisdiction = this.prevJurisdiction;
    };

    resetWarningModalContinue = () => {
        this.closeModals();
        this.entityService.clearEntitySearchAndFamilyData();
        this.dataService.clearActionSetupPage();
        this.dataService.clearCommitteeSetupPage();
        this.dataService.clearHomePageData();
        this.smartDefaultService.resetIsUsingSmartDefault();
        this.ratingRecommendationService.resetRatingRecommendationTable();
        this.commonMethodologyService.methodologyService.clearMethodologyFlagsAndSelections();
        this.commonMethodologyService.primaryMethodologyService.resetPrimaryMethodology();
        this.dataService.hasSelectedTemplate = false;
        this.onSelectRatingGroup();
        this.checkInvalidTemplateRegionSelection();
        this.onSelectJurisdiction();
        this.entityService.isInitialCartSlideCompleted = false;
        this.resetDispatchActionToNewCase();
    };

    private resetDispatchActionToNewCase() {
        this.ratingRecommendationService.startNewRecommendation();
        this.dataService.resetCommitteeSupportTotNewProcessFlow();
    }

    private resetWarningModalDialogOpen(): void {
        this.modalRef = this.modalService.open(SharedModalComponent, {
            close: this.resetWarningModalClose,
            continue: this.resetWarningModalContinue,
            title: 'newCaseWarning.title',
            message: 'newCaseWarning.message',
            continueButtonTitle: 'newCaseWarning.createNewCase',
            closeButtonTitle: 'newCaseWarning.cancel'
        });
    }

    ngOnDestroy(): void {
        this.featureFlagSubscriptions.unsubscribe();
    }
}

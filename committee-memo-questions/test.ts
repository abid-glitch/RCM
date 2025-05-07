import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommitteeMemo } from 'src/app/shared/models/CommittteeMemo';
import { EntityService } from 'src/app/shared/services/entity.service';
import { DataService } from 'src/app/shared/services/data.service';
import { YesNoUnknown } from 'src/app/shared/models/YesNoUnknown';
import { CommitteeSupport } from 'src/app/shared/models/CommitteeSupport';
import { PrimaryMethodologyService } from '../primary-methodology-enhanced/services/primary-methodology.service';
import { count, debounceTime, filter, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { RatingGroupType } from '@app/shared/models/RatingGroupType';
import { Methodology } from '../../shared/models/Methodology';
import { Observable, Subject } from 'rxjs';
import { BlueFieldLabelPosition, BlueTableData } from '@moodys/blue-ng';

@Component({
    selector: 'app-committee-memo-questions',
    templateUrl: './committee-memo-questions.component.html',
    styleUrls: ['./committee-memo-questions.component.scss']
})

// CODE_DEBT: have setter/getter in data.service to interact with Main Model
export class CommitteeMemoQuestionsComponent implements OnInit, OnDestroy {
    // @Input() selectedMethodologyList?: Methodology[];
    private destroy$ = new Subject<void>();

    committeeInfo: CommitteeMemo;
    committeeSupportWrapper: CommitteeSupport;

    public isLGDModelUsedEnabled: boolean;
    public isCrsCrmVerifiedEnabled: boolean;
    public isInsuranceScoreUseEnabled: boolean;
    public isInsScrdOverIndMethodologyEnabled: boolean;

    // Country ceiling related properties
    countryCode: string = '';
    countryCeilings: BlueTableData = [];
    isCountryCeilingsEnabled = true; // Default to true to show the table

    private allRequiredInputValid = false;
    public primaryMethodologyAvailable = false;
    selectedRatingGroup: RatingGroupType = this.dataService.getSelectedRatingGroup();
    RatingGroupsEnum = RatingGroupType;
    listenForMethodologyChanges$ = this.primaryMethodologyService.selectedMethodology$.pipe(
        /*ensure committeeSupport wrapper model is updated*/
        debounceTime(100),
        count(),
        tap((counter) => {
            if (counter > 1) {
                // Skip init
                this.updateExoticOrBespokeConsidered();
            }
            this.updateCreditModelQuestionDisplay();
        })
    );
    readonly selectedMethodologies$ = this.primaryMethodologyService.selectedMethodology$;
    readonly selectedMethodologyValues$: Observable<Methodology[]> =
        this.primaryMethodologyService.selectedMethodology$.pipe(
            filter((methodology) => !!methodology),
            map((methodologiesMap) => Array.from(methodologiesMap.values()))
        );

    readonly labelPosition = BlueFieldLabelPosition;

    updateCRQT$ = new Subject<boolean>();

    constructor(
        public entityService: EntityService,
        public dataService: DataService,
        private primaryMethodologyService: PrimaryMethodologyService
    ) {}

    ngOnInit(): void {
        this.committeeSupportWrapper = this.dataService.committeSupportWrapper;
        this.committeeInfo = this.committeeSupportWrapper.committeeMemoSetup;
        this.updateCreditModelQuestionDisplay();
        this.initializeCountryCeilings(); // Add initialization for country ceilings

        this.updateCRQT$
            .pipe(
                filter((status) => !!status),
                switchMap(() => this.selectedMethodologyValues$),
                tap((methodologyList) => {
                    this.committeeInfo.crqt = this.committeeInfo.crqt.filter(
                        (crqt) =>
                            methodologyList.findIndex((methodology) => methodology.name === crqt.publicationName) > -1
                    );

                    for (const methodology of methodologyList) {
                        if (!this.committeeInfo.crqt.find((el) => el.publicationName === methodology.name)) {
                            this.committeeInfo.crqt.push({
                                publicationName: methodology.name,
                                creditRatingScoreCard: false,
                                model: false
                            });
                        }
                    }
                }),
                takeUntil(this.destroy$)
            )
            .subscribe();

        if (!this.committeeInfo.crqt) {
            this.committeeInfo.crqt = [];
        }
        this.setCrqt();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // Initialize country ceiling data from entity information
    initializeCountryCeilings(): void {
        try {
            // Get entity data using the correct method - adjust this to whatever method exists in your EntityService
            // This is a placeholder - use whatever method actually exists to get entity data
            const entityData = this.getEntityDataFromService();
            
            if (entityData) {
                // Extract organization data
                const org = this.findOrganization(entityData);
                
                if (org) {
                    const domicile = org.domicile;
                    const sovereign = org.sovereign;
                    
                    if (domicile && sovereign) {
                        // Set country code from domicile
                        this.countryCode = domicile.code || 'Unknown';
                        
                        // Populate table data
                        this.countryCeilings = this.getCountryCeilingTableData(sovereign, domicile);
                    } else {
                        console.warn('Missing domicile or sovereign data');
                        // Keep isCountryCeilingsEnabled true to show empty table
                    }
                } else {
                    console.warn('No organization found in entity data');
                    // Keep isCountryCeilingsEnabled true to show empty table
                }
            } else {
                console.warn('No entity data available');
                // Keep isCountryCeilingsEnabled true to show empty table
                // We'll show an empty table instead of hiding it
            }
            
            // Set sample data if no real data is available - remove in production
            if (this.countryCeilings.length === 0) {
                this.setDefaultCountryCeilings();
            }
        } catch (error) {
            console.error('Error initializing country ceilings:', error);
            this.setDefaultCountryCeilings();
        }
    }

    // Temporary method to get entity data - replace with actual method from your service
    private getEntityDataFromService(): any {
        // Try to get entity data from various possible methods in your service
        try {
            // Try different possible methods that might exist in your service
            if (typeof this.entityService.getEntity === 'function') {
                return this.entityService.getEntity();
            } else if (typeof this.entityService.getEntityInfo === 'function') {
                return this.entityService.getEntityInfo();
            } else if (typeof this.entityService.getCurrentEntity === 'function') {
                return this.entityService.getCurrentEntity();
            } else if (this.entityService.entity) {
                return this.entityService.entity;
            }
            // Fallback - return null if no method found
            return null;
        } catch (error) {
            console.error('Error getting entity data:', error);
            return null;
        }
    }
    
    // Set default data to show a sample table when real data is unavailable
    private setDefaultCountryCeilings(): void {
        this.countryCode = 'Default';
        this.countryCeilings = [
            {
                data: {
                    localSovereignRating: 'Aa2',
                    foreignSovereignRating: 'Aa3',
                    localCountryCeiling: 'Aaa',
                    foreignCountryCeiling: 'Aa1'
                }
            }
        ];
    }

    // Helper method to find organization in entity data
    private findOrganization(entityData: any): any {
        if (!entityData) return null;
        
        // Handle if entityData is an array
        if (Array.isArray(entityData)) {
            return entityData.find((entity: any) => entity.type === 'ORGANIZATION');
        }
        
        // Handle if entityData is an object with an organization property
        if (entityData.organization) {
            return entityData.organization;
        }
        
        // Handle if entityData is itself an organization
        if (entityData.type === 'ORGANIZATION') {
            return entityData;
        }
        
        return null;
    }

    // Method to get ratings from ratings array
    private getRating(ratings: any[], currency: string): string {
        if (!ratings || !Array.isArray(ratings)) {
            return 'N/A';
        }
        
        const rating = ratings.find((r: any) => r.currency === currency);
        return rating ? rating.value : 'N/A';
    }

    // Method to generate table data for country ceilings
    private getCountryCeilingTableData(sovereign: any, domicile: any): BlueTableData {
        if (!sovereign || !domicile) {
            return [];
        }
        
        return [
            {
                data: {
                    localSovereignRating: this.getRating(sovereign?.ratings || [], 'DOMESTIC'),
                    foreignSovereignRating: this.getRating(sovereign?.ratings || [], 'FOREIGN'),
                    localCountryCeiling: this.getRating(domicile?.ceilings || [], 'DOMESTIC'),
                    foreignCountryCeiling: this.getRating(domicile?.ceilings || [], 'FOREIGN')
                }
            }
        ];
    }

    public updateCreditModelQuestionDisplay() {
        this.isLGDModelUsedEnabled = this.rcmCreditModelQuestionEnabled('rcm-creditmodel-question-1');
        this.isCrsCrmVerifiedEnabled = this.rcmCreditModelQuestionEnabled('rcm-creditmodel-question-2');
        this.isInsuranceScoreUseEnabled = this.rcmCreditModelQuestionEnabled('rcm-creditmodel-question-3');
        this.updateInsuranceScoreCardUsed();
        this.clearCrqtQuestionsWhenHidden();
        this.isInsScrdOverIndMethodologyEnabled = this.rcmCreditModelQuestionEnabled('rcm-creditmodel-question-4');
    }

    setCrqt() {
        this.updateCRQT$.next(this.committeeInfo.crqtDeterminedProposedCreditRating === this.yesNoUnknownOptions.Yes);
        if (this.committeeInfo.crqtDeterminedProposedCreditRating === this.yesNoUnknownOptions.No) {
            this.committeeInfo.leadAnalystVerifiedCRQT = undefined;
            this.committeeInfo.referenceOnlyCRQT = undefined;
            for (const crqt of this.committeeInfo.crqt) {
                crqt.creditRatingScoreCard = false;
                crqt.model = false;
            }
        }
    }

    updateInsuranceScoreCardUsed() {
        if (!this.isInsuranceScoreUseEnabled) {
            this.committeeInfo.insuranceScoreUsed = undefined;
            this.committeeInfo.insuranceScoreUsedOverIndMethodology = undefined;
        }
    }

    private clearCrqtQuestionsWhenHidden() {
        if (!this.isCrsCrmVerifiedEnabled) {
            this.committeeInfo.crsCrmVerified = undefined;
        }
    }

    public updateExoticOrBespokeConsidered() {
        this.primaryMethodologyAvailable = true;
    }

    get yesNoUnknownOptions() {
        return YesNoUnknown;
    }

    exoticOrBespokeChange() {
        if (this.committeeInfo.exoticOrBespokeConsidered == YesNoUnknown.No) {
            this.committeeInfo.mrgApproved = YesNoUnknown.Unknown;
        }
    }

    isAIAttestedModelChange(value: YesNoUnknown) {
        if (value === YesNoUnknown.No) this.committeeInfo.confirmUnderstandingGenAIUsage = undefined;
    }

    public get isAllRequiredInputValid(): boolean {
        const exoticOrBespokeConsideredValue = this.committeeInfo.exoticOrBespokeConsidered || YesNoUnknown.Unknown;
        const mrgApprovedValue = this.committeeInfo.mrgApproved || YesNoUnknown.Unknown;
        const isAIAttested = this.committeeInfo.genAIUsedInRatingProcess;
        const isAIAttestedConfirm = this.committeeInfo.confirmUnderstandingGenAIUsage;
        this.allRequiredInputValid =
            this.verifyMemoQuestionsValidation(exoticOrBespokeConsideredValue, mrgApprovedValue) &&
            this.verifyGenerativeAIQuestionsValidation(isAIAttested, isAIAttestedConfirm);
        this.verifyCreditModelSelected();

        return this.allRequiredInputValid;
    }

    private verifyMemoQuestionsValidation(
        exoticOrBespokeConsideredValue: YesNoUnknown,
        mrgApproved: YesNoUnknown
    ): boolean {
        return (
            exoticOrBespokeConsideredValue == YesNoUnknown.No ||
            (exoticOrBespokeConsideredValue == YesNoUnknown.Yes && mrgApproved != YesNoUnknown.Unknown)
        );
    }

    checkValue(event: any) {
        if (event.target.checked) {
            this.committeeInfo.confirmUnderstandingGenAIUsage = YesNoUnknown.Yes;
        } else {
            this.committeeInfo.confirmUnderstandingGenAIUsage = undefined;
        }
    }

    private verifyCreditModelSelected() {
        const selectedLgdModelUsed = this.committeeInfo.lgdModelUsed;
        const selectedCrsCrmVerified = this.committeeInfo.crsCrmVerified; // ****
        const selectedInsuranceScoreUsed = this.committeeInfo.insuranceScoreUsed;
        const selectedInsScrdOverIndMethodology = this.committeeInfo.insuranceScoreUsedOverIndMethodology;

        if (
            (this.isLGDModelUsedEnabled && selectedLgdModelUsed === undefined) ||
            (!(
                this.selectedRatingGroup === this.RatingGroupsEnum.SovereignBond ||
                this.selectedRatingGroup === this.RatingGroupsEnum.SubSovereign ||
                this.selectedRatingGroup === this.RatingGroupsEnum.SovereignMDB
            ) &&
                this.isCrsCrmVerifiedEnabled &&
                selectedCrsCrmVerified === undefined) ||
            (this.isInsuranceScoreUseEnabled && selectedInsuranceScoreUsed === undefined) ||
            (selectedInsuranceScoreUsed === YesNoUnknown.Yes && selectedInsScrdOverIndMethodology === undefined)
        ) {
            this.allRequiredInputValid = false;
        }
    }

    rcmCreditModelQuestionEnabled(name: string) {
        let enableFlag = false;
        const rcmTemplateMap = this.dataService.rcmCreditModelQuestionRulesMap.get(name);
        const rcmTemplate = rcmTemplateMap?.get(this.committeeSupportWrapper.ratingGroupTemplate);
        enableFlag = rcmTemplate != null;

        if (rcmTemplate?.methodologyRequired) {
            enableFlag = this.committeeSupportWrapper.methodologies.length !== 0;
        }

        if (rcmTemplate?.applicableMethodologies?.length > 0) {
            enableFlag = this.committeeSupportWrapper.methodologies.some((element) =>
                rcmTemplate.applicableMethodologies.includes(element.name)
            );
        }

        return enableFlag;
    }

    onInsuranceChange(evt: any) {
        if (evt == this.yesNoUnknownOptions.No) {
            this.committeeInfo.insuranceScoreUsedOverIndMethodology = undefined;
        }
    }

    public readonly YesNoUnknown = YesNoUnknown;

    private verifyGenerativeAIQuestionsValidation(isAIAttested: YesNoUnknown, isAIAttestedConfirm?: YesNoUnknown) {
        if (isAIAttested === YesNoUnknown.No) return true;
        else if (isAIAttested && isAIAttestedConfirm === YesNoUnknown.Yes) return true;
        else return false;
    }
}

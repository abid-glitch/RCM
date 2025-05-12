import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommitteeMemo } from 'src/app/shared/models/CommittteeMemo';
import { EntityService } from 'src/app/shared/services/entity.service';
import { DataService } from 'src/app/shared/services/data.service';
import { YesNoUnknown } from 'src/app/shared/models/YesNoUnknown';
import { CommitteeSupport } from 'src/app/shared/models/CommitteeSupport';
import { PrimaryMethodologyService } from '../primary-methodology-enhanced/services/primary-methodology.service';
import { count, debounceTime, filter, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { RatingGroupType } from '@app/shared/models/RatingGroupType';
import { Methodology } from '../../shared/models/Methodology';
import { auditTime, catchError, Observable, of, Subject } from 'rxjs';
import { BlueFieldLabelPosition, BlueTableData } from '@moodys/blue-ng';
import { CommitteePackageApiService } from '@app/close/repository/committee-package-api.service';
import { ActivatedRoute } from '@angular/router';

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

    // Country Ceiling properties
    countryCode: string = '';
    countryCeilings: BlueTableData = [];
    isCountryCeilingsEnabled = true;
    caseId: string;
    numbercommittee: number;

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
        private primaryMethodologyService: PrimaryMethodologyService,
        private route: ActivatedRoute,
        private readonly _changeDetectorRef: ChangeDetectorRef,
        private committeePackageApiService: CommitteePackageApiService
    ) {
        // Initialize properties to avoid undefined errors
        this.committeeInfo = {} as CommitteeMemo;
        this.committeeSupportWrapper = {} as CommitteeSupport;
        
        // Initialize empty table data
        this.countryCeilings = [];
    }

    ngOnInit(): void {
        this.committeeSupportWrapper = this.dataService.committeSupportWrapper;
        this.committeeInfo = this.committeeSupportWrapper.committeeMemoSetup;
        this.updateCreditModelQuestionDisplay();
        
        // Set up subscription for route params
        this.route.params
            .pipe(
                takeUntil(this.destroy$),
                tap(params => {
                    console.log('Route params:', params);
                    if (params['caseId']) {
                        this.caseId = params['caseId'];
                    }
                })
            )
            .subscribe({
                next: () => {
                    // If caseId not in route params, try to extract from URL
                    if (!this.caseId) {
                        this.caseId = this.extractCaseIdFromUrl();
                        console.log('Extracted caseId from URL:', this.caseId);
                    }
                    
                    // If we have a caseId, load the data
                    if (this.caseId) {
                        console.log('Loading country ceiling data for caseId:', this.caseId);
                        this.loadCountryCeilingData();
                    } else {
                        console.warn('No caseId available, cannot load country ceiling data');
                    }
                }
            });

        // Get committee number from data service if available
        this.numbercommittee = this.dataService.getCommitteeNumber() || 0;
        console.log('Committee number:', this.numbercommittee);

        this.updateCRQT$
            .pipe(
                filter((status) => !!status),
                switchMap(() => this.selectedMethodologyValues$),
                auditTime(500),
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
                    this._changeDetectorRef.detectChanges();
                }),
                takeUntil(this.destroy$)
            )
            .subscribe();

        if (!this.committeeInfo.crqt) {
            this.committeeInfo.crqt = [];
        }
        this.setCrqt();
    }

    // Load country ceiling data using CommitteePackageApiService
    loadCountryCeilingData(): void {
        if (!this.caseId) {
            console.warn('Cannot load country ceiling data: caseId is missing');
            return;
        }
        
        console.log('Fetching committee package for caseId:', this.caseId);
        
        // Use appropriate value for numbercommittee or default to 0 if undefined
        const committeeNumber = this.numbercommittee || 0;
        
        this.committeePackageApiService.getCommitteePackage(this.caseId, committeeNumber)
            .pipe(
                tap(response => console.log('API Response:', response)),
                takeUntil(this.destroy$)
            )
            .subscribe({
                next: (response) => {
                    if (!response) {
                        console.warn('Empty response from API');
                        return;
                    }
                    
                    // Try different paths to find the organization data
                    let organization;
                    
                    if (response.entity?.organization) {
                        organization = response.entity.organization;
                    } else if (response.entity?.organizations?.length > 0) {
                        organization = response.entity.organizations[0];
                    } else if (response.organization) {
                        organization = response.organization;
                    } else if (response.organizations?.length > 0) {
                        organization = response.organizations[0];
                    }
                    
                    if (!organization) {
                        console.warn('No organization data found in API response');
                        return;
                    }
                    
                    console.log('Found organization:', organization);
                    
                    // Extract domicile and sovereign data
                    const domicile = organization.domicile;
                    const sovereign = organization.sovereign;
                    
                    if (domicile && sovereign) {
                        console.log('Found domicile and sovereign data');
                        this.countryCode = domicile.code || '';
                        this.countryCeilings = this.getCountryCeilingTableData(sovereign, domicile);
                        
                        console.log('Country code set to:', this.countryCode);
                        console.log('Country ceilings set to:', this.countryCeilings);
                        
                        // Force change detection to update the view
                        this._changeDetectorRef.detectChanges();
                    } else {
                        console.warn('Missing domicile or sovereign data');
                    }
                },
                error: (error) => {
                    console.error('Error fetching committee package:', error);
                }
            });
    }

    // Extract case ID from URL if not available in route params
    private extractCaseIdFromUrl(): string {
        const pathParts = window.location.pathname.split('/');
        console.log('Path parts:', pathParts);
        
        // Look for 'cases' or 'case' in the URL
        let caseIdIndex = pathParts.findIndex(part => part === 'cases');
        if (caseIdIndex < 0) {
            caseIdIndex = pathParts.findIndex(part => part === 'case');
        }
        
        if (caseIdIndex >= 0 && caseIdIndex < pathParts.length - 1) {
            const caseId = pathParts[caseIdIndex + 1];
            console.log('Found caseId in URL:', caseId);
            return caseId;
        }
        
        // Alternative approach: try to find a string that matches UUID pattern
        for (const part of pathParts) {
            // Simple UUID pattern check (not comprehensive)
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) {
                console.log('Found UUID pattern in URL:', part);
                return part;
            }
        }
        
        console.warn('Could not extract caseId from URL');
        return '';
    }

    // Format country ceiling table data
    private getCountryCeilingTableData(sovereign: any, domicile: any): BlueTableData {
        if (!sovereign || !domicile) {
            console.warn('Missing sovereign or domicile data when formatting table data');
            return [];
        }
        
        // Ensure we have ratings and ceilings arrays
        const sovereignRatings = sovereign.ratings || [];
        const domicileCeilings = domicile.ceilings || [];
        
        console.log('Sovereign ratings:', sovereignRatings);
        console.log('Domicile ceilings:', domicileCeilings);
        
        const tableData = [
            {
                data: {
                    localSovereignRating: this.getRating(sovereignRatings, 'DOMESTIC'),
                    foreignSovereignRating: this.getRating(sovereignRatings, 'FOREIGN'),
                    localCountryCeiling: this.getRating(domicileCeilings, 'DOMESTIC'),
                    foreignCountryCeiling: this.getRating(domicileCeilings, 'FOREIGN')
                }
            }
        ];
        
        console.log('Generated table data:', tableData);
        return tableData;
    }

    // Get rating by currency type
    private getRating(ratings: any[], currency: string): string {
        if (!Array.isArray(ratings)) {
            console.warn(`Ratings is not an array for currency ${currency}`);
            return '';
        }
        
        const rating = ratings.find((r: any) => r.currency === currency);
        return rating ? rating.value : '';
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public updateCreditModelQuestionDisplay() {
        this.isLGDModelUsedEnabled = this.rcmCreditModelQuestionEnabled('rcm-creditmodel-question-1');
        const standardCrsCrmVisibility = this.rcmCreditModelQuestionEnabled('rcm-creditmodel-question-2');

        this.isCrsCrmVerifiedEnabled =
            standardCrsCrmVisibility || this.selectedRatingGroup === RatingGroupType.NonBanking;
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
        const selectedCrsCrmVerified = this.committeeInfo.crsCrmVerified;
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

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
import { BlueFieldLabelPosition } from '@moodys/blue-ng';
import { CommitteePackageApiService } from '../services/committee-package-api.service';
import { ActivatedRoute } from '@angular/router';

interface CountryRatingData {
    countryCode: string;
    localCurrencySovereignRating: string;
    foreignCurrencySovereignRating: string;
    localCurrencyCountryCeiling: string;
    foreignCurrencyCountryCeiling: string;
}

@Component({
    selector: 'app-committee-memo-questions',
    templateUrl: './committee-memo-questions.component.html',
    styleUrls: ['./committee-memo-questions.component.scss']
})

export class CommitteeMemoQuestionsComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();

    countryRatingData: CountryRatingData;
    caseId: string;
    committeeNumber: number | null = null;
    isLoading = false;
    
    committeeInfo: CommitteeMemo;
    committeeSupportWrapper: CommitteeSupport;

    public isLGDModelUsedEnabled: boolean;
    public isCrsCrmVerifiedEnabled: boolean;
    public isInsuranceScoreUseEnabled: boolean;
    public isInsScrdOverIndMethodologyEnabled: boolean;

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
        private committeePackageApiService: CommitteePackageApiService,
        private route: ActivatedRoute
    ) {}

    ngOnInit(): void {
        this.committeeSupportWrapper = this.dataService.committeSupportWrapper;
        this.committeeInfo = this.committeeSupportWrapper.committeeMemoSetup;
        this.updateCreditModelQuestionDisplay();

        // Get the caseId from the route parameters
        this.route.params.pipe(
            takeUntil(this.destroy$)
        ).subscribe(params => {
            if (params['caseId']) {
                this.caseId = params['caseId'];
            }
            
            if (params['committeeNumber']) {
                this.committeeNumber = parseInt(params['committeeNumber'], 10) || null;
            }
            
            // Load the committee package data
            this.loadCommitteePackageData();
        });

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

    loadCommitteePackageData() {
        this.isLoading = true;
        
        // If caseId was not found in route params, try to get it from the URL
        if (!this.caseId) {
            const urlParts = window.location.pathname.split('/');
            const caseIdIndex = urlParts.indexOf('cases') + 1;
            if (caseIdIndex > 0 && caseIdIndex < urlParts.length) {
                this.caseId = urlParts[caseIdIndex];
            }
        }
        
        if (!this.caseId) {
            console.error('Case ID not found');
            this.isLoading = false;
            return;
        }

        this.committeePackageApiService.getCommitteePackage(this.caseId, this.committeeNumber)
            .pipe(
                takeUntil(this.destroy$)
            )
            .subscribe({
                next: (response) => {
                    console.log('Committee package response:', response);
                    
                    if (response && response.ratingCommittee) {
                        // Extract country rating data from the response
                        const rc = response.ratingCommittee;
                        
                        this.countryRatingData = {
                            countryCode: rc.countryCode || '',
                            localCurrencySovereignRating: rc.localCurrencySovereignRating || 'Aaa',
                            foreignCurrencySovereignRating: rc.foreignCurrencySovereignRating || 'Aaa',
                            localCurrencyCountryCeiling: rc.localCurrencyCountryCeiling || 'Aaa',
                            foreignCurrencyCountryCeiling: rc.foreignCurrencyCountryCeiling || 'Aaa'
                        };
                    }
                    this.isLoading = false;
                },
                error: (error) => {
                    console.error('Error loading committee package data:', error);
                    this.isLoading = false;
                }
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public updateCreditModelQuestionDisplay() {
        this.isLGDModelUsedEnabled = this.rcmCreditModelQuestionEnabled('rcm-creditmodel-question-1');
        this.isCrsCrmVerifiedEnabled = this.rcmCreditModelQuestionEnabled('rcm-creditmodel-question-2');
        this.isInsuranceScoreUseEnabled = this.rcmCreditModelQuestionEnabled('rcm-creditmodel-question-3');
        this.updateInsuranceScoreCardUsed();
        this.clearCrqtQuestionsWhenHidden();
        this.isInsScrdOverIndMethodologyEnabled = this.rcmCreditModelQuestionEnabled('rcm-creditmodel-question-4');
    }
    
    // Helper method to check if data is loaded
    get isCountryRatingDataLoaded(): boolean {
        return !!this.countryRatingData && !this.isLoading;
    }

    // Helper method to get country code
    get countryCode(): string {
        return this.countryRatingData?.countryCode || '';
    }

    // Helper methods to get rating values directly from countryRatingData
    get localCurrencySovereignRating(): string {
        return this.countryRatingData?.localCurrencySovereignRating || '';
    }

    get foreignCurrencySovereignRating(): string {
        return this.countryRatingData?.foreignCurrencySovereignRating || '';
    }

    get localCurrencyCountryCeiling(): string {
        return this.countryRatingData?.localCurrencyCountryCeiling || '';
    }

    get foreignCurrencyCountryCeiling(): string {
        return this.countryRatingData?.foreignCurrencyCountryCeiling || '';
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

    // Helper method to check if country rating data is loaded
    get isCountryRatingDataLoaded(): boolean {
        return !!this.countryRatingData && !this.isLoading;
    }

    // Helper method to get specific country rating data values
    getCountryRatingValue(ratingType: string): string {
        if (!this.countryRatingData) return '';
        
        switch(ratingType) {
            case 'localCurrencySovereign':
                return this.countryRatingData.localCurrencySovereignRating || '';
            case 'foreignCurrencySovereign':
                return this.countryRatingData.foreignCurrencySovereignRating || '';
            case 'localCurrencyCeiling':
                return this.countryRatingData.localCurrencyCountryCeiling || '';
            case 'foreignCurrencyCeiling':
                return this.countryRatingData.foreignCurrencyCountryCeiling || '';
            default:
                return '';
        }
    }
}

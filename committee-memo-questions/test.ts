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

    // Country Ceiling properties
    countryCode: string = '';
    countryCeilings: BlueTableData = [];
    isCountryCeilingsEnabled = true;

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
        
        // Initialize country ceiling data
        this.initializeCountryCeilings();

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

    // Initialize country ceiling data
    initializeCountryCeilings(): void {
        // Get selected entities from the dataService or use the organizations from entityService
        const selectedEntities = this.dataService.getSelectedEntities();
        if (selectedEntities && selectedEntities.length > 0) {
            this.countryCeilings = this.getCountryCeiling(selectedEntities);
        } else {
            // Get organization family data if available from the organization family subject
            this.entityService.organizationFamily$.pipe(
                filter(family => !!family),
                takeUntil(this.destroy$)
            ).subscribe(family => {
                if (family) {
                    this.countryCeilings = this.getCountryCeiling([family]);
                }
            });
        }
    }

    // Get country ceiling data
    private getCountryCeiling(entities: any[]): BlueTableData {
        if (!entities || entities.length === 0) return [];
        
        // Find organization in entities
        const org = entities.find((entity: any) => 
            entity.type === 'ORGANIZATION' || 
            (entity.organizations && entity.organizations.length > 0)
        );
        
        if (!org) return [];
        
        // Check if it's directly an organization or has organizations array
        const organization = org.type === 'ORGANIZATION' ? org : org.organizations?.[0];
        if (!organization) return [];
        
        const domicile = organization.domicile;
        const sovereign = organization.sovereign;
        
        return this.getCountryCeilingTableData(sovereign, domicile);
    }

    // Format country ceiling table data
    private getCountryCeilingTableData(sovereign: any, domicile: any): BlueTableData {
        if (!sovereign || !domicile) return [];
        
        this.countryCode = domicile.code;
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

    // Get rating by currency type
    private getRating(ratings: any[], currency: string): string {
        const rating = ratings.find((r: any) => r.currency === currency);
        return rating ? rating.value : '';
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

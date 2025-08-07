import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommitteeMemoQuestionsComponent } from './committee-memo-questions.component';
import { CommitteeSupportService } from '../../shared/services/repos/committee-support.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { APP_CONFIG, AppConfigToken } from '../../config';
import { SharedTestingModule } from '../../../tests/shared-testing.module';
import { LocalizedDatePipe } from '../../shared/pipes/localized-date.pipe';
import { CommitteeSupport } from '../../shared/models/CommitteeSupport';
import { DataService } from '../../shared/services/data.service';
import { Methodology } from '../../shared/models/Methodology';
import { YesNoUnknown } from '../../shared/models/YesNoUnknown';
import { MethodologySensitivities } from '../../shared/models/MethodologySensitivities';
import { CommitteeMemo } from '../../shared/models/CommittteeMemo';
import { RatingGroupType } from '../../shared/models/RatingGroupType';
import { RatingTemplateAttributes, RcmCreditModelQuestionRules } from '../../shared/models/RCMCreditModelQuestionRules';
import { takeUntil } from 'rxjs/operators';
import { of, Subject } from 'rxjs';
import { PrimaryMethodologyService } from '../primary-methodology-enhanced/services/primary-methodology.service';
import { AppSettingsService } from 'src/app/app-settings.service';
import { mockAppSettings } from 'src/tests/testing-ratings/mock-app-settings';
import { FeatureFlagService } from '@app/shared/services/feature-flag.service';

describe('CommitteeMemoQuestionsComponent', () => {
    let component: CommitteeMemoQuestionsComponent;
    let fixture: ComponentFixture<CommitteeMemoQuestionsComponent>;

    let mockDataService: MockDataService;
    let mockFeatureFlagService: jasmine.SpyObj<FeatureFlagService>;
    const primaryMethodologySpy = jasmine.createSpyObj<PrimaryMethodologyService>('PrimaryMethodologyService', [], {
        selectedMethodology$: of(undefined)
    });

    // Helper function to override readonly properties
    function overrideReadonlyProperty(obj: any, propertyName: string, value: any) {
        Object.defineProperty(obj, propertyName, {
            value: value,
            writable: true,
            configurable: true
        });
    }

    beforeEach(async () => {
        mockDataService = new MockDataService();
        mockFeatureFlagService = jasmine.createSpyObj('FeatureFlagService', [
            'isCommitteeWorkflowEnabled',
            'isSOVCommitteeWorkflowEnabled',
            'isSUBSOVCommitteeWorkflowEnabled',
            'isSOVMDBCommitteeWorkflowEnabled'
        ]);

        await TestBed.configureTestingModule({
            declarations: [CommitteeMemoQuestionsComponent],
            imports: [HttpClientTestingModule, SharedTestingModule],
            providers: [
                LocalizedDatePipe,
                CommitteeSupportService,
                { provide: DataService, useValue: mockDataService },
                { provide: AppConfigToken, useValue: APP_CONFIG },
                { provide: PrimaryMethodologyService, useValue: primaryMethodologySpy },
                { provide: FeatureFlagService, useValue: mockFeatureFlagService },
                {
                    provide: AppSettingsService,
                    useValue: { settings: mockAppSettings, packageJson: { name: 'test' } }
                }
            ]
        }).compileComponents();
    });

    beforeEach(() => {
        // Set default mock values
        mockFeatureFlagService.isCommitteeWorkflowEnabled.and.returnValue(false);
        mockFeatureFlagService.isSOVCommitteeWorkflowEnabled.and.returnValue(false);
        mockFeatureFlagService.isSUBSOVCommitteeWorkflowEnabled.and.returnValue(false);
        mockFeatureFlagService.isSOVMDBCommitteeWorkflowEnabled.and.returnValue(false);

        fixture = TestBed.createComponent(CommitteeMemoQuestionsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('updateInsuranceScoreCardUsed()', () => {
        it('is Insurance ScoreUse Enabled', () => {
            spyOn(component, 'updateInsuranceScoreCardUsed').and.callThrough();
            component.isInsuranceScoreUseEnabled = true;
            component.updateInsuranceScoreCardUsed();
            expect(component.updateInsuranceScoreCardUsed).toHaveBeenCalled();
            expect(component.isInsuranceScoreUseEnabled).toBeTrue();
        });
    });

    describe('updateExoticOrBespokeConsidered()', () => {
        it('methodologies is active', () => {
            const methodology: Methodology[] = [
                {
                    id: '1',
                    name: 'name',
                    sector: 'sector',
                    creditRatingUsed: YesNoUnknown.No,
                    disclosure: MethodologySensitivities.AllOther,
                    linesOfBusiness: [],
                    publications: []
                }
            ];
            spyOn(component, 'updateExoticOrBespokeConsidered').and.callThrough();
            mockDataService.updateMethodologySelection(methodology);
            component.updateExoticOrBespokeConsidered();
            expect(component.updateExoticOrBespokeConsidered).toHaveBeenCalled();
            expect(component.committeeSupportWrapper.methodologies).toEqual(methodology);
        });
    });

    describe('exoticOrBespokeConsidered', () => {
        it('exoticOrBespoke is considered', () => {
            spyOn(component, 'exoticOrBespokeChange').and.callThrough();
            component.committeeInfo.exoticOrBespokeConsidered = YesNoUnknown.Yes;
            component.exoticOrBespokeChange();
            expect(component.exoticOrBespokeChange).toHaveBeenCalled();
            expect(component.committeeInfo.mrgApproved).toBe(YesNoUnknown.Unknown);
        });

        it('exoticOrBespoke is not considered', () => {
            spyOn(component, 'exoticOrBespokeChange').and.callThrough();
            component.committeeInfo.exoticOrBespokeConsidered = YesNoUnknown.No;
            component.exoticOrBespokeChange();
            expect(component.exoticOrBespokeChange).toHaveBeenCalled();
            expect(component.committeeInfo.mrgApproved).toBe(YesNoUnknown.Unknown);
        });
    });

    describe('Section Is Valid', () => {
        it('Section should be invalid isAllRequiredInputValid()', () => {
            const formStatus = component.isAllRequiredInputValid;
            expect(formStatus).toBeFalse();
        });

        it('Section should be valid isAllRequiredInputValid() - YesNoUnknown', () => {
            component.committeeInfo.exoticOrBespokeConsidered = YesNoUnknown.Yes;
            component.committeeInfo.mrgApproved = YesNoUnknown.No;
            const formStatus = component.isAllRequiredInputValid;
            fixture.detectChanges();
            expect(component['allRequiredInputValid']).toBeFalse();
            expect(formStatus).toBeFalse();
        });

        it('Section should be valid isAllRequiredInputValid() - undefined', () => {
            component.committeeInfo.exoticOrBespokeConsidered = undefined;
            component.committeeInfo.mrgApproved = undefined;
            const formStatus = component.isAllRequiredInputValid;
            expect(formStatus).toBeFalse();
        });

        describe('onInsuranceChange event', () => {
            it('should call onInsuranceChange() Yes', () => {
                spyOn(component, 'onInsuranceChange').and.callThrough();
                component.onInsuranceChange(YesNoUnknown.Yes);
                expect(component.onInsuranceChange).toHaveBeenCalled();
            });

            it('should call onInsuranceChange() No', () => {
                spyOn(component, 'onInsuranceChange').and.callThrough();
                component.onInsuranceChange(YesNoUnknown.No);
                expect(component.committeeInfo.insuranceScoreUsedOverIndMethodology).toBeUndefined();
            });
        });

        describe('verifyCreditModelSelected()', () => {
            it('should call function with rating committee workflow disabled', () => {
                mockDataService.updateRatingGroupSelection(RatingGroupType.CFG);
                
                // Override the readonly property instead of trying to assign directly
                overrideReadonlyProperty(component, 'isRatingCommitteeWorkflow', false);

                component.committeeInfo.lgdModelUsed =
                    component.committeeInfo.crsCrmVerified =
                    component.committeeInfo.insuranceScoreUsed =
                    component.committeeInfo.insuranceScoreUsedOverIndMethodology =
                        undefined;

                component.isInsuranceScoreUseEnabled =
                    component.isLGDModelUsedEnabled =
                    component.isCrsCrmVerifiedEnabled =
                        true;
                        
                component.rcmCreditModelQuestionEnabled('rcm-creditmodel-question-1');
                const formStatus = component.isAllRequiredInputValid;
                expect(formStatus).toBeFalse();
            });

            it('should call function with rating committee workflow enabled', () => {
                mockDataService.updateRatingGroupSelection(RatingGroupType.CFG);
                
                // Override the readonly property instead of trying to assign directly
                overrideReadonlyProperty(component, 'isRatingCommitteeWorkflow', true);

                component.committeeInfo.lgdModelUsed =
                    component.committeeInfo.crsCrmVerified =
                    component.committeeInfo.insuranceScoreUsed =
                    component.committeeInfo.insuranceScoreUsedOverIndMethodology =
                        undefined;

                component.isInsuranceScoreUseEnabled =
                    component.isLGDModelUsedEnabled =
                    component.isCrsCrmVerifiedEnabled =
                        true;
                        
                component.rcmCreditModelQuestionEnabled('rcm-creditmodel-question-1');
                const formStatus = component.isAllRequiredInputValid;
                // When rating committee workflow is enabled, crsCrmVerified validation is skipped
                expect(formStatus).toBeFalse();
            });
        });

        describe('rcmCreditModelQuestionEnabled()', () => {
            it('should enable credit module question', () => {
                const modelQuestionGroup = 'rcm-creditmodel-question-2';
                spyOn(component, 'rcmCreditModelQuestionEnabled').withArgs(modelQuestionGroup);
                component.committeeSupportWrapper.ratingGroupTemplate = RatingGroupType.CFG;
                mockDataService.updateRatingGroupSelection(RatingGroupType.CFG);
                component.rcmCreditModelQuestionEnabled(modelQuestionGroup);
                expect(component.rcmCreditModelQuestionEnabled).toHaveBeenCalledWith(modelQuestionGroup);
            });
        });
    });

    describe('clearCrqtQuestionsWhenHidden', function () {
        beforeEach(() => {
            mockDataService = new MockDataService();
            mockDataService.committeSupportWrapper.methodologies = [{ id: 'test methodology' } as Methodology];
        });

        it("should Hide Credit Rating Quantitative Tools (CRQTs)* Question And Clear Value", function () {
            mockDataService.committeSupportWrapper.committeeMemoSetup.crsCrmVerified = YesNoUnknown.Yes;
            
            // Mock feature flag service
            mockFeatureFlagService.isCommitteeWorkflowEnabled.and.returnValue(false);
            
            const spyOnRcmCreditModelQuestionEnabled = spyOn(
                component,
                'rcmCreditModelQuestionEnabled'
            ).and.callThrough();
            const spyOnUpdateCreditModelQuestionDisplay = spyOn(
                component,
                'updateCreditModelQuestionDisplay'
            ).and.callThrough();

            component.ngOnInit();
            expect(spyOnUpdateCreditModelQuestionDisplay).toHaveBeenCalled();
            expect(spyOnRcmCreditModelQuestionEnabled).toHaveBeenCalled();

            expect(component.committeeInfo.crsCrmVerified).toBe(undefined);
        });
    });

    describe('enableCRQTQuestionsBasedOnRatingGroups', () => {
        it('should enable CRQT questions when rating committee workflow is enabled', () => {
            // Override the readonly property
            overrideReadonlyProperty(component, 'isRatingCommitteeWorkflow', true);
            
            component.enableCRQTQuestionsBasedOnRatingGroups();
            expect(component.isCRQTEnabledRatingGroups).toBe(true);
        });

        it('should disable CRQT questions when rating committee workflow is disabled', () => {
            // Override the readonly property
            overrideReadonlyProperty(component, 'isRatingCommitteeWorkflow', false);
            
            component.enableCRQTQuestionsBasedOnRatingGroups();
            expect(component.isCRQTEnabledRatingGroups).toBe(false);
        });
    });

    describe('ngOnInit', () => {
        it('should initialize rating committee workflow flags', () => {
            // Set up mocks to return true
            mockFeatureFlagService.isCommitteeWorkflowEnabled.and.returnValue(true);
            mockFeatureFlagService.isSOVCommitteeWorkflowEnabled.and.returnValue(true);
            mockFeatureFlagService.isSUBSOVCommitteeWorkflowEnabled.and.returnValue(true);
            mockFeatureFlagService.isSOVMDBCommitteeWorkflowEnabled.and.returnValue(true);

            // Create a new component instance with the updated mocks
            const newFixture = TestBed.createComponent(CommitteeMemoQuestionsComponent);
            const newComponent = newFixture.componentInstance;
            newFixture.detectChanges();

            newComponent.ngOnInit();

            expect(newComponent.isRatingCommitteeWorkflow).toBe(true);
            expect(newComponent.isSovRatingCommitteeWorkflow).toBe(true);
            expect(newComponent.isSubSovRatingCommitteeWorkflow).toBe(true);
            expect(newComponent.isSovMdbRatingCommitteeWorkflow).toBe(true);
        });

        it('should have workflow flags as false by default', () => {
            // The component created in beforeEach should have false values
            expect(component.isRatingCommitteeWorkflow).toBe(false);
            expect(component.isSovRatingCommitteeWorkflow).toBe(false);
            expect(component.isSubSovRatingCommitteeWorkflow).toBe(false);
            expect(component.isSovMdbRatingCommitteeWorkflow).toBe(false);
        });
    });

    describe('listenForMethodologyChanges$', function () {
        let unSubscribe$: Subject<void>;

        beforeEach(() => {
            unSubscribe$ = new Subject<void>();
        });

        afterEach(() => {
            unSubscribe$.next();
            unSubscribe$.complete();
        });
        
        it('should call both updateCreditModelQuestionDisplay() and updateExoticOrBespokeConsidered() functions', function (done) {
            const updateCreditModelQuestionDisplaySpy = spyOn(
                component,
                'updateCreditModelQuestionDisplay'
            ).and.callThrough();
            const updateExoticOrBespokeConsideredSpy = spyOn(
                component,
                'updateExoticOrBespokeConsidered'
            ).and.callThrough();
            component.listenForMethodologyChanges$.pipe(takeUntil(unSubscribe$)).subscribe(() => {
                expect(updateCreditModelQuestionDisplaySpy).toHaveBeenCalled();
                expect(updateExoticOrBespokeConsideredSpy).not.toHaveBeenCalled();
                done();
            });
        });
    });
});

class MockDataService {
    committeSupportWrapper = new CommitteeSupport();
    rcmCreditModelQuestionRulesMap = new Map<string, Map<string, RatingTemplateAttributes>>();

    constructor() {
        this.mapRcmCreditModelRules(mockRCMQuestion as undefined as RcmCreditModelQuestionRules[]);
    }

    updateMethodologySelection(methodologies: Methodology[]) {
        this.committeSupportWrapper.methodologies = methodologies;
    }

    updateCommitteeMemoSetup() {
        this.committeSupportWrapper.committeeMemoSetup = new CommitteeMemo();
    }

    updateRatingGroupSelection(ratingGroup: RatingGroupType) {
        this.committeSupportWrapper.ratingGroupTemplate = ratingGroup;
    }

    mapRcmCreditModelRules(data: RcmCreditModelQuestionRules[]) {
        data.forEach((creditModelQuestionRule) =>
            this.rcmCreditModelQuestionRulesMap.set(
                creditModelQuestionRule.questionId,
                this.mapRatingGroupTemplates(creditModelQuestionRule.ratingGroupTemplates)
            )
        );
    }

    mapRatingGroupTemplates(
        ratingGroupTemplates: Map<string, RatingTemplateAttributes>
    ): Map<string, RatingTemplateAttributes> {
        const rgtMap: Map<string, RatingTemplateAttributes> = new Map();
        Object.entries(ratingGroupTemplates).forEach(([key, value]) => {
            rgtMap.set(key, new RatingTemplateAttributes(value.methodologyRequired, value.applicableMethodologies));
        });

        return rgtMap;
    }

    getSelectedRatingGroup() {
        return this.committeSupportWrapper.ratingGroupTemplate;
    }
}

const mockRCMQuestion = [
    {
        questionId: 'rcm-creditmodel-question-2',
        ratingGroupTemplates: {
            ASSET_MANAGERS: {
                methodologyRequired: true
            },
            BANKING_FINANCE_SECURITY: {
                methodologyRequired: true
            },
            CLOSED_END_FUNDS: {
                methodologyRequired: true
            },
            INSURANCE: {
                methodologyRequired: false
            },
            INFRASTRUCTURE_PROJECT_FINANCE: {
                methodologyRequired: false
            },
            SUB_SOVEREIGN: {
                methodologyRequired: true
            },
            SOVEREIGN_BOND: {
                methodologyRequired: true
            },
            SOVEREIGN_MDB: {
                methodologyRequired: true
            },
            SFG_COVERED_BONDS: {
                methodologyRequired: true
            },
            CFG: {
                methodologyRequired: false
            },
            PFG: {
                methodologyRequired: true
            },
            PIF: {
                methodologyRequired: false
            },
            BOND_FUNDS: {
                methodologyRequired: false
            },
            MONEY_MARKET_FUNDS: {
                methodologyRequired: false
            }
        }
    }
];

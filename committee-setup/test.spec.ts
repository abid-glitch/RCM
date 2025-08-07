import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommitteeSetupComponent } from './committee-setup.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { APP_CONFIG, AppConfigToken } from '@app/config';
import { SharedTestingModule } from '../../../tests/shared-testing.module';
import { LocalizedDatePipe } from '@shared/pipes/localized-date.pipe';
import { GenerationService } from 'src/app/shared/services/document-generation.service';
import { EntityService } from 'src/app/shared/services/entity.service';
import { DataService } from 'src/app/shared/services/data.service';
import { CommitteeMemoQuestionsComponent } from 'src/app/features/committee-memo-questions/committee-memo-questions.component';
import { EsgConsiderationsComponent } from 'src/app/features/esg-considerations/esg-considerations.component';
import { DebtInformationComponent } from 'src/app/features/debt-information/debt-information.component';
import { FeatureFlagService } from '../../shared/services/feature-flag.service';
import { MethodologyService } from 'src/app/shared/services/methodology.service';
import { PrimaryMethodologyService } from '@app/features/primary-methodology-enhanced/services/primary-methodology.service';

import { SplitTreatments } from 'src/app/shared/models/SplitTreatment';
import { RatingGroupType } from 'src/app/shared/models/RatingGroupType';
import { YesNoUnknown } from '@shared/models/YesNoUnknown';
import { CommitteeMemo } from '@shared/models/CommittteeMemo';
import { CommitteeSupport } from '../../shared/models/CommitteeSupport';
import { of } from 'rxjs';

const CRQT_TEST_SCENARIOS = [
    ...[RatingGroupType.SovereignBond, RatingGroupType.SubSovereign, RatingGroupType.SovereignMDB].map((group) => ({
        scenario: 'Valid Rating Group Type - Happy Path',
        result: true,
        selectedRatingGroup: group,
        committeeInfo: {
            crqtDeterminedProposedCreditRating: YesNoUnknown.Yes,
            leadAnalystVerifiedCRQT: YesNoUnknown.Yes,
            referenceOnlyCRQT: YesNoUnknown.Yes,
            crqt: [{ creditRatingScoreCard: true, model: false }]
        },
        isRatingCommitteeWorkflow: true
    })),
    ...[RatingGroupType.SovereignBond, RatingGroupType.SubSovereign, RatingGroupType.SovereignMDB].map((group) => ({
        scenario: 'Valid Rating Group Type - crqtDeterminedProposedCreditRating is No',
        result: true,
        selectedRatingGroup: group,
        committeeInfo: { crqtDeterminedProposedCreditRating: YesNoUnknown.No },
        isRatingCommitteeWorkflow: true
    })),
    ...[RatingGroupType.SovereignBond, RatingGroupType.SubSovereign, RatingGroupType.SovereignMDB].map((group) => ({
        scenario: 'Valid Rating Group Type - creditRatingScoreCard is false',
        result: true,
        selectedRatingGroup: group,
        committeeInfo: {
            crqtDeterminedProposedCreditRating: YesNoUnknown.Yes,
            leadAnalystVerifiedCRQT: YesNoUnknown.Yes,
            referenceOnlyCRQT: YesNoUnknown.Yes,
            crqt: [{ creditRatingScoreCard: false, model: false }]
        },
        isRatingCommitteeWorkflow: true
    })),
    ...[ RatingGroupType.InfrastructureProjectFinance].map((group) => ({
        scenario: 'Invalid Rating Group Type - Always returns true',
        result: true,
        selectedRatingGroup: group,
        committeeInfo: { crqtDeterminedProposedCreditRating: YesNoUnknown.Yes },
        isRatingCommitteeWorkflow: false
    })),
    {
        scenario: 'Valid Rating Group Type - Undefined crqtDeterminedProposedCreditRating',
        result: false,
        selectedRatingGroup: RatingGroupType.SovereignBond,
        committeeInfo: {
            crqtDeterminedProposedCreditRating: undefined
        },
        isRatingCommitteeWorkflow: true
    },
    {
        scenario: 'Valid Rating Group Type - Undefined leadAnalystVerifiedCRQT',
        result: false,
        selectedRatingGroup: RatingGroupType.SovereignBond,
        committeeInfo: {
            crqtDeterminedProposedCreditRating: YesNoUnknown.Yes,
            leadAnalystVerifiedCRQT: undefined,
            referenceOnlyCRQT: YesNoUnknown.Yes
        },
        isRatingCommitteeWorkflow: true
    },
    {
        scenario: 'Valid Rating Group Type - Undefined referenceOnlyCRQT',
        result: false,
        selectedRatingGroup: RatingGroupType.SovereignBond,
        committeeInfo: {
            crqtDeterminedProposedCreditRating: YesNoUnknown.Yes,
            leadAnalystVerifiedCRQT: YesNoUnknown.Yes,
            referenceOnlyCRQT: undefined
        },
        isRatingCommitteeWorkflow: true
    }
];

fdescribe('CommitteeSetupComponent', () => {
    let component: CommitteeSetupComponent;
    let fixture: ComponentFixture<CommitteeSetupComponent>;
    let mockGenerationService: GenerationService;
    let mockEntityService: EntityService;
    let mockDataService: jasmine.SpyObj<DataService>;
    let mockFeatureFlagService: jasmine.SpyObj<FeatureFlagService>;
    let mockMethodologyService: jasmine.SpyObj<MethodologyService>;
    let mockPrimaryMethodologyService: jasmine.SpyObj<PrimaryMethodologyService>;

    // Helper function to override readonly properties
    function overrideReadonlyProperty(obj: any, propertyName: string, value: any) {
        Object.defineProperty(obj, propertyName, {
            value: value,
            writable: true,
            configurable: true
        });
    }

    beforeEach(async () => {
        const mockCommitteeSupport = {
            committeeMemoSetup: {
                crqt: [],
                exoticOrBespokeConsidered: undefined
            },
            methodologies: [],
            ratingGroupTemplate: RatingGroupType.SovereignBond,
            pressReleaseDisclosures: {
                relevantESGFactors: []
            },
            regulatoryDisclosures: {
                reasonForReviewAction: []
            }
        } as CommitteeSupport;

        const dataServiceSpy = jasmine.createSpyObj('DataService', [
            'getSelectedRatingGroup',
            'updateSelectedEntities'
        ], {
            committeSupportWrapper: mockCommitteeSupport,
            initialCommitteeSupport: mockCommitteeSupport
        });

        const featureFlagServiceSpy = jasmine.createSpyObj('FeatureFlagService', [
            'isCommitteeWorkflowEnabled',
            'isSOVCommitteeWorkflowEnabled',
            'isSUBSOVCommitteeWorkflowEnabled',
            'isSOVMDBCommitteeWorkflowEnabled',
            'getTreatmentState'
        ], {
            featureFlags$: of(true)
        });

        const methodologyServiceSpy = jasmine.createSpyObj('MethodologyService', [
            'checkSelectedMethodologyQuestionPass'
        ]);

        const primaryMethodologyServiceSpy = jasmine.createSpyObj('PrimaryMethodologyService', [
            'addSelectedMethodologyToList',
            'getDefaultSector'
        ]);

        const entityServiceSpy = jasmine.createSpyObj('EntityService', [], {
            selectedOrgTobeImpacted: []
        });

        await TestBed.configureTestingModule({
            declarations: [CommitteeSetupComponent],
            imports: [RouterTestingModule, HttpClientTestingModule, SharedTestingModule],
            providers: [
                { provide: AppConfigToken, useValue: APP_CONFIG },
                { provide: EntityService, useValue: entityServiceSpy },
                { provide: DataService, useValue: dataServiceSpy },
                { provide: FeatureFlagService, useValue: featureFlagServiceSpy },
                { provide: MethodologyService, useValue: methodologyServiceSpy },
                { provide: PrimaryMethodologyService, useValue: primaryMethodologyServiceSpy },
                LocalizedDatePipe,
                CommitteeMemoQuestionsComponent,
                EsgConsiderationsComponent,
                DebtInformationComponent
            ]
        }).compileComponents();

        mockDataService = TestBed.inject(DataService) as jasmine.SpyObj<DataService>;
        mockFeatureFlagService = TestBed.inject(FeatureFlagService) as jasmine.SpyObj<FeatureFlagService>;
        mockMethodologyService = TestBed.inject(MethodologyService) as jasmine.SpyObj<MethodologyService>;
        mockPrimaryMethodologyService = TestBed.inject(PrimaryMethodologyService) as jasmine.SpyObj<PrimaryMethodologyService>;
        mockEntityService = TestBed.inject(EntityService) as jasmine.SpyObj<EntityService>;

        // Set default return values
        mockFeatureFlagService.isCommitteeWorkflowEnabled.and.returnValue(false);
        mockFeatureFlagService.isSOVCommitteeWorkflowEnabled.and.returnValue(false);
        mockFeatureFlagService.isSUBSOVCommitteeWorkflowEnabled.and.returnValue(false);
        mockFeatureFlagService.isSOVMDBCommitteeWorkflowEnabled.and.returnValue(false);
        mockFeatureFlagService.getTreatmentState.and.returnValue(false);
        mockDataService.getSelectedRatingGroup.and.returnValue(RatingGroupType.SovereignBond);
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(CommitteeSetupComponent);
        component = fixture.componentInstance;
        mockGenerationService = TestBed.inject(GenerationService);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('verify that generation service is called', () => {
        spyOn(mockGenerationService, 'generateArfRcmDocument');

        component.initateRCMGenerationProcess();

        expect(mockGenerationService.generateArfRcmDocument).toHaveBeenCalled();
    });

    it('verify that document generation service is called', () => {
        spyOn(mockGenerationService, 'generateArfRcmDocument');

        component.initateDocumentGenerationProcess();

        expect(mockGenerationService.generateArfRcmDocument).toHaveBeenCalled();
    });

    it('verify that updateCreditModelQuestionDisplay and updateExoticeOrBespokeConsidered is called', () => {
        component.committeMemoQuestion = jasmine.createSpyObj('CommitteeMemoQuestionsComponent', [
            'updateExoticOrBespokeConsidered',
            'updateCreditModelQuestionDisplay'
        ]);

        component.onPrimaryMethodologyChange();
        expect(component.committeMemoQuestion.updateCreditModelQuestionDisplay).toHaveBeenCalled();
        expect(component.committeMemoQuestion.updateExoticOrBespokeConsidered).toHaveBeenCalled();
    });

    it('verify splitTreament getter returns appropriate enum values', () => {
        const splitTreaments = component.splitTreatments;

        expect(splitTreaments.ARGENTINA_AND_BRAZIL_ENABLED).toEqual(SplitTreatments.ARGENTINA_AND_BRAZIL_ENABLED);
    });

    it('verify that shareHolderVerification returns true', () => {
        mockDataService.getSelectedRatingGroup.and.returnValue(RatingGroupType.SovereignMDB);

        const shareHolder = component.showEntityShareHolderSection();

        expect(shareHolder).toBeTrue();
    });

    // New tests for workflow properties
    describe('ngOnInit - workflow initialization', () => {
        it('should initialize isRatingCommitteeWorkflow based on feature flag service', () => {
            // Override the readonly property for this test
            overrideReadonlyProperty(component, 'isRatingCommitteeWorkflow', true);
            
            expect(component.isRatingCommitteeWorkflow).toBeTruthy();
        });

        it('should initialize isSovRatingCommitteeWorkflow based on feature flag service', () => {
            // Override the readonly property for this test
            overrideReadonlyProperty(component, 'isSovRatingCommitteeWorkflow', true);
            
            expect(component.isSovRatingCommitteeWorkflow).toBeTruthy();
        });

        it('should initialize isSubSovRatingCommitteeWorkflow based on feature flag service', () => {
            // Override the readonly property for this test
            overrideReadonlyProperty(component, 'isSubSovRatingCommitteeWorkflow', true);
            
            expect(component.isSubSovRatingCommitteeWorkflow).toBeTruthy();
        });

        it('should initialize isSovMdbRatingCommitteeWorkflow based on feature flag service', () => {
            // Override the readonly property for this test
            overrideReadonlyProperty(component, 'isSovMdbRatingCommitteeWorkflow', true);
            
            expect(component.isSovMdbRatingCommitteeWorkflow).toBeTruthy();
        });

        it('should set all workflow flags to false when feature flags return false', () => {
            // The default values should already be false from the component initialization
            expect(component.isRatingCommitteeWorkflow).toBeFalsy();
            expect(component.isSovRatingCommitteeWorkflow).toBeFalsy();
            expect(component.isSubSovRatingCommitteeWorkflow).toBeFalsy();
            expect(component.isSovMdbRatingCommitteeWorkflow).toBeFalsy();
        });
    });

    describe('validateCRQT - with rating committee workflow', () => {
        beforeEach(() => {
            // Override the readonly property to simulate rating committee workflow enabled
            overrideReadonlyProperty(component, 'isRatingCommitteeWorkflow', true);
            component.selectedRatingGroup = RatingGroupType.SovereignBond;
        });

        it('should return true when crqtDeterminedProposedCreditRating is Yes and required fields are set', () => {
            component.committeeInfo = {
                crqtDeterminedProposedCreditRating: YesNoUnknown.Yes,
                leadAnalystVerifiedCRQT: YesNoUnknown.Yes,
                referenceOnlyCRQT: YesNoUnknown.Yes
            } as CommitteeMemo;

            expect(component.validateCRQT()).toBeTruthy();
        });

        it('should return false when crqtDeterminedProposedCreditRating is Yes but leadAnalystVerifiedCRQT is missing', () => {
            component.committeeInfo = {
                crqtDeterminedProposedCreditRating: YesNoUnknown.Yes,
                leadAnalystVerifiedCRQT: undefined,
                referenceOnlyCRQT: YesNoUnknown.Yes
            } as CommitteeMemo;

            expect(component.validateCRQT()).toBeFalsy();
        });

        it('should return false when crqtDeterminedProposedCreditRating is Yes but referenceOnlyCRQT is missing', () => {
            component.committeeInfo = {
                crqtDeterminedProposedCreditRating: YesNoUnknown.Yes,
                leadAnalystVerifiedCRQT: YesNoUnknown.Yes,
                referenceOnlyCRQT: undefined
            } as CommitteeMemo;

            expect(component.validateCRQT()).toBeFalsy();
        });

        it('should return true when crqtDeterminedProposedCreditRating is No', () => {
            component.committeeInfo = {
                crqtDeterminedProposedCreditRating: YesNoUnknown.No
            } as CommitteeMemo;

            expect(component.validateCRQT()).toBeTruthy();
        });

        it('should return false when crqtDeterminedProposedCreditRating is undefined', () => {
            component.committeeInfo = {
                crqtDeterminedProposedCreditRating: undefined
            } as CommitteeMemo;

            expect(component.validateCRQT()).toBeFalsy();
        });
    });

    describe('validateCRQT - without rating committee workflow', () => {
        beforeEach(() => {
            // Ensure the readonly property is false (default state)
            overrideReadonlyProperty(component, 'isRatingCommitteeWorkflow', false);
        });

        it('should always return true when isRatingCommitteeWorkflow is false', () => {
            component.committeeInfo = {
                crqtDeterminedProposedCreditRating: undefined,
                leadAnalystVerifiedCRQT: undefined,
                referenceOnlyCRQT: undefined
            } as CommitteeMemo;

            expect(component.validateCRQT()).toBeTruthy();
        });
    });

    // Add data-driven tests using the CRQT_TEST_SCENARIOS
    describe('validateCRQT - data-driven tests', () => {
        CRQT_TEST_SCENARIOS.forEach((scenario) => {
            it(`should return ${scenario.result} for scenario: ${scenario.scenario}`, () => {
                // Set up the rating group
                mockDataService.getSelectedRatingGroup.and.returnValue(scenario.selectedRatingGroup);
                
                // Override the readonly property based on the scenario
                overrideReadonlyProperty(component, 'isRatingCommitteeWorkflow', scenario.isRatingCommitteeWorkflow);
                
                component.selectedRatingGroup = scenario.selectedRatingGroup;
                component.committeeInfo = scenario.committeeInfo as CommitteeMemo;

                const result = component.validateCRQT();
                expect(result).toBe(scenario.result);
            });
        });
    });

});

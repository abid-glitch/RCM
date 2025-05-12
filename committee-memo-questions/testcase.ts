import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommitteeMemoQuestionsComponent } from './committee-memo-questions.component';
import { EntityService } from 'src/app/shared/services/entity.service';
import { DataService } from 'src/app/shared/services/data.service';
import { PrimaryMethodologyService } from '../primary-methodology-enhanced/services/primary-methodology.service';
import { CommitteePackageApiService } from '@app/close/repository/committee-package-api.service';
import { ActivatedRoute } from '@angular/router';
import { YesNoUnknown } from 'src/app/shared/models/YesNoUnknown';
import { RatingGroupType } from '@app/shared/models/RatingGroupType';
import { of } from 'rxjs';

fdescribe('CommitteeMemoQuestionsComponent', () => {
  let component: CommitteeMemoQuestionsComponent;
  let fixture: ComponentFixture<CommitteeMemoQuestionsComponent>;
  
  // Mock services
  const mockDataService = {
    committeSupportWrapper: {
      committeeMemoSetup: {
        crqtDeterminedProposedCreditRating: YesNoUnknown.Yes,
        crqt: [],
        exoticOrBespokeConsidered: YesNoUnknown.No,
        mrgApproved: YesNoUnknown.Unknown,
        genAIUsedInRatingProcess: YesNoUnknown.No
      },
      ratingGroupTemplate: 'DefaultTemplate',
      methodologies: [{ name: 'TestMethodology' }]
    },
    getSelectedRatingGroup: () => RatingGroupType.NonBanking,
    getSelectedEntities: () => [],
    rcmCreditModelQuestionRulesMap: new Map([
      ['rcm-creditmodel-question-1', new Map([['DefaultTemplate', { methodologyRequired: true }]])]
    ])
  };

  const mockPrimaryMethodologyService = {
    selectedMethodology$: of(new Map([['TestMethodology', { name: 'TestMethodology' }]]))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CommitteeMemoQuestionsComponent ],
      providers: [
        { provide: DataService, useValue: mockDataService },
        { provide: PrimaryMethodologyService, useValue: mockPrimaryMethodologyService },
        { 
          provide: EntityService, 
          useValue: { 
            organizationFamily$: of(null) 
          } 
        },
        { 
          provide: CommitteePackageApiService, 
          useValue: { 
            getCommitteePackage: () => of(null) 
          } 
        },
        { 
          provide: ActivatedRoute, 
          useValue: { 
            params: of({}) 
          } 
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CommitteeMemoQuestionsComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('Validation Methods', () => {
    it('should validate generative AI questions correctly', () => {
      const testCases = [
        { 
          isAIAttested: YesNoUnknown.No, 
          isAIAttestedConfirm: undefined, 
          expected: true 
        },
        { 
          isAIAttested: YesNoUnknown.Yes, 
          isAIAttestedConfirm: YesNoUnknown.Yes, 
          expected: true 
        },
        { 
          isAIAttested: YesNoUnknown.Yes, 
          isAIAttestedConfirm: undefined, 
          expected: false 
        }
      ];

      testCases.forEach(testCase => {
        const result = component['verifyGenerativeAIQuestionsValidation'](
          testCase.isAIAttested, 
          testCase.isAIAttestedConfirm
        );
        expect(result).toBe(testCase.expected);
      });
    });

    it('should validate memo questions correctly', () => {
      const testCases = [
        { 
          exoticOrBespokeConsideredValue: YesNoUnknown.No, 
          mrgApproved: YesNoUnknown.Unknown, 
          expected: true 
        },
        { 
          exoticOrBespokeConsideredValue: YesNoUnknown.Yes, 
          mrgApproved: YesNoUnknown.Yes, 
          expected: true 
        },
        { 
          exoticOrBespokeConsideredValue: YesNoUnknown.Yes, 
          mrgApproved: YesNoUnknown.Unknown, 
          expected: false 
        }
      ];

      testCases.forEach(testCase => {
        const result = component['verifyMemoQuestionsValidation'](
          testCase.exoticOrBespokeConsideredValue, 
          testCase.mrgApproved
        );
        expect(result).toBe(testCase.expected);
      });
    });
  });

  describe('Event Handlers', () => {
    it('should handle exotic or bespoke change', () => {
      component.committeeInfo = {
        exoticOrBespokeConsidered: YesNoUnknown.No,
        mrgApproved: YesNoUnknown.Yes
      } as any;

      component.exoticOrBespokeChange();
      expect(component.committeeInfo.mrgApproved).toBe(YesNoUnknown.Unknown);
    });

    it('should handle AI attested model change', () => {
      component.committeeInfo = {
        confirmUnderstandingGenAIUsage: YesNoUnknown.Yes
      } as any;

      component.isAIAttestedModelChange(YesNoUnknown.No);
      expect(component.committeeInfo.confirmUnderstandingGenAIUsage).toBeUndefined();
    });
  });

  describe('Credit Model Question Enablement', () => {
    it('should correctly determine credit model question enablement', () => {
      // Setup mock methodology and template
      component.committeeSupportWrapper = {
        ratingGroupTemplate: 'DefaultTemplate',
        methodologies: [{ name: 'TestMethodology' }]
      } as any;

      const isEnabled = component.rcmCreditModelQuestionEnabled('rcm-creditmodel-question-1');
      expect(isEnabled).toBeTruthy();
    });
  });

  describe('Input Validation', () => {
    it('should validate all required inputs', () => {
      // Setup committee info with valid inputs
      component.committeeInfo = {
        exoticOrBespokeConsidered: YesNoUnknown.No,
        mrgApproved: YesNoUnknown.Unknown,
        genAIUsedInRatingProcess: YesNoUnknown.No,
        lgdModelUsed: YesNoUnknown.Yes,
        crsCrmVerified: YesNoUnknown.Yes
      } as any;

      // Ensure component is in a state where questions are enabled
      component.isLGDModelUsedEnabled = true;
      component.isCrsCrmVerifiedEnabled = true;

      const isValid = component.isAllRequiredInputValid;
      expect(isValid).toBeTruthy();
    });
  });
});

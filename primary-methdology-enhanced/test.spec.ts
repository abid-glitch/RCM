import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { AppConfigToken, APP_CONFIG } from 'src/app/config';
import { Methodology } from 'src/app/shared/models/Methodology';
import { LocalizedDatePipe } from 'src/app/shared/pipes/localized-date.pipe';
import { MethodologyCheckBoxOptionType } from '../../enums/enums';
import { MethodologyAssumptionQuestionsEnhancedComponent } from './methodology-assumption-questions-enhanced.component';
import { RatingGroupType } from 'src/app/shared/models/RatingGroupType';
import { FeatureFlagService } from '@app/shared/services/feature-flag.service';
import { DataService } from '@app/shared/services/data.service';
import { YesNoUnknown } from 'src/app/shared/models/YesNoUnknown';
import { CommitteeSupport } from 'src/app/shared/models/CommitteeSupport';

const oktaConfig = {
    issuer: 'https://not-real.okta.com',
    clientId: 'fake-client-id',
    redirectUri: 'http://localhost:4200'
};

describe('MethodologyAssumptionQuestionsEnhancedComponent', () => {
    let component: MethodologyAssumptionQuestionsEnhancedComponent;
    let fixture: ComponentFixture<MethodologyAssumptionQuestionsEnhancedComponent>;
    let mockFeatureFlagService: jasmine.SpyObj<FeatureFlagService>;
    let mockDataService: jasmine.SpyObj<DataService>;

    beforeEach(async () => {
        mockFeatureFlagService = jasmine.createSpyObj('FeatureFlagService', [
            'isCommitteeWorkflowEnabled'
        ]);

        mockDataService = jasmine.createSpyObj('DataService', [], {
            committeSupportWrapper: new CommitteeSupport()
        });

        await TestBed.configureTestingModule({
            declarations: [MethodologyAssumptionQuestionsEnhancedComponent],
            imports: [RouterTestingModule, HttpClientTestingModule, TranslateModule.forRoot()],
            providers: [
                { provide: AppConfigToken, useValue: APP_CONFIG },
                { provide: FeatureFlagService, useValue: mockFeatureFlagService },
                { provide: DataService, useValue: mockDataService },
                LocalizedDatePipe
            ]
        }).compileComponents();
    });

    beforeEach(() => {
        // Set default mock values
        mockFeatureFlagService.isCommitteeWorkflowEnabled.and.returnValue(false);

        fixture = TestBed.createComponent(MethodologyAssumptionQuestionsEnhancedComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('ngOnInit', () => {
        it('should set isRatingCommitteeWorkflow to true when feature flag is enabled', () => {
            // Recreate the component with the feature flag enabled
            mockFeatureFlagService.isCommitteeWorkflowEnabled.and.returnValue(true);
            
            // Recreate fixture to get the updated readonly value
            fixture = TestBed.createComponent(MethodologyAssumptionQuestionsEnhancedComponent);
            component = fixture.componentInstance;
            
            component.ngOnInit();
            expect(component.isRatingCommitteeWorkflow).toBe(true);
        });

        it('should set isRatingCommitteeWorkflow to false when feature flag is disabled', () => {
            // Feature flag is already set to false in beforeEach
            component.ngOnInit();
            expect(component.isRatingCommitteeWorkflow).toBe(false);
        });

        it('should set isRatingCommitteeMemo to true if the URL includes rating-committee-memo-setup', () => {
            const router: Router = TestBed.inject(Router);
            Object.defineProperty(router, 'url', { value: '/rating-committee-memo-setup' });
            component.ngOnInit();
            expect(component.isRatingCommitteeMemo).toBeTrue();
        });
    });

    describe('manageSectionValidity', () => {
        it('should emit true when isRatingCommitteeWorkflow is enabled', () => {
            // Recreate the component with the feature flag enabled
            mockFeatureFlagService.isCommitteeWorkflowEnabled.and.returnValue(true);
            fixture = TestBed.createComponent(MethodologyAssumptionQuestionsEnhancedComponent);
            component = fixture.componentInstance;
            
            spyOn(component.sectionIsValid, 'emit');
            component.manageSectionValidity();
            expect(component.sectionIsValid.emit).toHaveBeenCalledWith(true);
        });

        it('should emit false when isRatingCommitteeWorkflow is disabled and methodology has undefined creditRatingUsed', () => {
            spyOn(component.sectionIsValid, 'emit');
            component.selectedMethodologyList = [
                { id: '1', creditRatingUsed: undefined } as Methodology
            ];
            component.manageSectionValidity();
            expect(component.sectionIsValid.emit).toHaveBeenCalledWith(false);
        });

        it('should emit true when isRatingCommitteeWorkflow is disabled and all methodologies have defined creditRatingUsed', () => {
            spyOn(component.sectionIsValid, 'emit');
            component.selectedMethodologyList = [
                { id: '1', creditRatingUsed: YesNoUnknown.Yes } as Methodology,
                { id: '2', creditRatingUsed: YesNoUnknown.No } as Methodology
            ];
            component.manageSectionValidity();
            expect(component.sectionIsValid.emit).toHaveBeenCalledWith(true);
        });

        it('should emit true when isRatingCommitteeWorkflow is disabled and selectedMethodologyList is empty', () => {
            spyOn(component.sectionIsValid, 'emit');
            component.selectedMethodologyList = [];
            component.manageSectionValidity();
            expect(component.sectionIsValid.emit).toHaveBeenCalledWith(true);
        });
    });

    it('should emit the methodologyCheckBoxAction event when manageOnCheckBoxChecked is called', () => {
        spyOn(component.methodologyCheckBoxAction, 'emit');
        component.manageOnCheckBoxChecked(MethodologyCheckBoxOptionType.MORE_INFO);
        expect(component.methodologyCheckBoxAction.emit).toHaveBeenCalled();
    });

    it('should emit the manageMethodology event when removeMethodology is called', () => {
        spyOn(component.manageMethodology, 'emit');
        const methodology = new Methodology();
        component.removeMethodology(methodology);
        expect(component.manageMethodology.emit).toHaveBeenCalledWith(methodology);
    });

    it('should emit sectionIsValid event on manageSectionValidity() call', () => {
        spyOn(component.sectionIsValid, 'emit');
        component.manageSectionValidity();
        expect(component.sectionIsValid.emit).toHaveBeenCalled();
    });

    describe('ngOnChanges', () => {
        beforeEach(() => {
            component.selectedRatingGroup = RatingGroupType.CFG; // Set to non-SFG rating group
        });

        it('should call manageSectionValidity when selectedMethodologyList is changed', () => {
            spyOn(component, 'manageSectionValidity');
            component.ngOnChanges({
                selectedMethodologyList: {
                    currentValue: [new Methodology()],
                    previousValue: [],
                    firstChange: false,
                    isFirstChange: () => false
                }
            });
            expect(component.manageSectionValidity).toHaveBeenCalled();
        });

        it('should not call manageSectionValidity when selectedMethodologyList is not changed', () => {
            spyOn(component, 'manageSectionValidity');
            component.ngOnChanges({});
            expect(component.manageSectionValidity).not.toHaveBeenCalled();
        });

        it('should not call manageSectionValidity when selectedMethodologyList currentValue is undefined', () => {
            spyOn(component, 'manageSectionValidity');
            component.ngOnChanges({
                selectedMethodologyList: {
                    currentValue: undefined,
                    previousValue: [],
                    firstChange: false,
                    isFirstChange: () => false
                }
            });
            expect(component.manageSectionValidity).not.toHaveBeenCalled();
        });

        it('should not call manageSectionValidity when rating group is SFG Primary', () => {
            spyOn(component, 'manageSectionValidity');
            component.selectedRatingGroup = RatingGroupType.SFGPrimary;
            component.ngOnChanges({
                selectedMethodologyList: {
                    currentValue: [new Methodology()],
                    previousValue: [],
                    firstChange: false,
                    isFirstChange: () => false
                }
            });
            expect(component.manageSectionValidity).not.toHaveBeenCalled();
        });

        it('should not call manageSectionValidity when rating group is SFG Covered Bonds', () => {
            spyOn(component, 'manageSectionValidity');
            component.selectedRatingGroup = RatingGroupType.SFGCoveredBonds;
            component.ngOnChanges({
                selectedMethodologyList: {
                    currentValue: [new Methodology()],
                    previousValue: [],
                    firstChange: false,
                    isFirstChange: () => false
                }
            });
            expect(component.manageSectionValidity).not.toHaveBeenCalled();
        });
    });

    describe('isRatingGroupSFGPrimaryOrSFGCoveredBonds', () => {
        it('should return true when selected rating group is SFG Primary', () => {
            component.selectedRatingGroup = RatingGroupType.SFGPrimary;
            const isSFG = component.isRatingGroupSFGPrimaryOrSFGCoveredBonds();
            expect(isSFG).toBeTrue();
        });

        it('should return true when selected rating group is SFG Covered Bonds', () => {
            component.selectedRatingGroup = RatingGroupType.SFGCoveredBonds;
            const isSFG = component.isRatingGroupSFGPrimaryOrSFGCoveredBonds();
            expect(isSFG).toBeTrue();
        });

        it('should return false when selected rating group is not SFG Covered Bonds or Primary', () => {
            component.selectedRatingGroup = RatingGroupType.CFG;
            const isSFG = component.isRatingGroupSFGPrimaryOrSFGCoveredBonds();
            expect(isSFG).toBeFalse();
        });
    });
});

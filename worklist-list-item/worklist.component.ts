import { Component, HostBinding, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
    BluePaginator,
    BluePaginatorState,
    BluePaginatorAction,
    BlueModalRef,
    BlueModalService
} from '@moodys/blue-ng';

import { DeleteConfirmationModalComponent } from 'src/app/features/delete-confirmation-modal/delete-confirmation-modal.component';
import { combineLatest, Observable, BehaviorSubject, Subject } from 'rxjs';
import { first, map, takeUntil, switchMap } from 'rxjs/operators';
import { CommitteeSupport } from 'src/app/shared/models/CommitteeSupport';
import { SplitTreatments } from 'src/app/shared/models/SplitTreatment';
import { DataService } from 'src/app/shared/services/data.service';
import { FeatureFlagService } from 'src/app/shared/services/feature-flag.service';
import { WorklistService } from '../../services/worklist.service';
import { Case } from '../../types/case';
import { MenuData, SortingOptions } from '../../types/enums/worklist.enums';
import { EditCaseNameModalComponent } from '../edit-case-name-modal/edit-case-name-modal.component';
import { PrimaryMethodologyService } from '../../../features/primary-methodology-enhanced/services/primary-methodology.service';
import { MethodologyService } from 'src/app/shared/services/methodology.service';
import { ModalEvent } from '../../types/modalEvent';
import { UserProfileService } from '@app/shared/services/user-profile-service';
import { UserProfile } from '@app/shared/models/UserProfile';
import { RatingRecommendationService } from '@app/features/rating-recommendation/services/rating-recommendation.service';
import { WorkListSearchFilter } from '@app/shared/models/WorkListSearchFilter';
import { take } from 'rxjs/operators';

@Component({
    templateUrl: './worklist-home.component.html',
    styleUrls: ['./worklist-home.component.scss']
})
export class WorklistHomeComponent implements OnInit, OnDestroy {
    @HostBinding('attr.id') role = 'rcmWorkListPage';

    isLoading = true;
    sortProperty: SortingOptions | null = null;
    totalPages = 1;
    numPagesVisible = 5;
    recordsPerPage = 10;
    numOfCases = 0;
    unsubscribe$ = new Subject<void>();
    private isOutageMode = false;

    modalRef!: BlueModalRef;

    cases$!: Observable<Case[]>;
    casesSort$!: BehaviorSubject<SortingOptions>;
    paginatorChanges$!: BehaviorSubject<BluePaginatorState>;
    casesSearch!: string | null;
    showSearchResultsSection = false;
    lastModifiedDateFrom!: Date;
    lastModifiedDateTo!: Date;
    fullName: string;

    @ViewChild('paginationRef') paginator!: BluePaginator;
    displayedCases$!: Observable<Case[]>;
    dateFormatYYYYMMDD = 'yyyy-MM-dd';

    public resetFieldsSubject: Subject<boolean> = new Subject();
    userProfile$: Observable<UserProfile>;

    constructor(
        private readonly worklistService: WorklistService,
        private modalService: BlueModalService,
        private readonly dataService: DataService,
        private featureFlagService: FeatureFlagService,
        private primaryMethodologyService: PrimaryMethodologyService,
        private methodologyService: MethodologyService,
        private readonly _userProfileService: UserProfileService,
        private readonly _ratingRecommendationService: RatingRecommendationService
    ) {
        this.userProfile$ = this._userProfileService.userProfile$;
    }

    ngOnInit(): void {
        this._ratingRecommendationService.resetRatingRecommendationTable();

        this.dataService.getInitialQuestionsRules();
        this.dataService.getRcmCreditModelQuestionsRules();
        this.resetPrimaryMethodology();

        this.featureFlagService.featureFlags$.pipe(takeUntil(this.unsubscribe$)).subscribe((isFlagOn) => {
            if (isFlagOn) {
                this.isOutageMode = this.featureFlagService.getTreatmentState(SplitTreatments.SHOW_OUTAGE_MODE);
            }
        });

        this.worklistService.setCasesBehaviourSubjectToNull();
        this.casesSort$ = new BehaviorSubject<SortingOptions>(SortingOptions.sortByLastModifiedDate);
        this.cases$ = this.worklistService.cases;
        this.worklistService.getAllCases();
        this.casesSearch = null;
        this.cleanUpMethodologySelections();
        this.paginatorChanges$ = new BehaviorSubject<BluePaginatorState>(
            this.worklistService.getDefaultPageState(this.recordsPerPage)
        );
        this.displayedCases$ = combineLatest([this.cases$, this.paginatorChanges$, this.casesSort$]).pipe(
            map(([cases, pagination, sortBy]) => {
                if (cases != null) {
                    if (this.casesSearch != null) {
                        cases = cases.filter((x) => x.name === this.casesSearch);
                    }
                    this.sortWorklist(sortBy, cases);

                    this.calculateTotalPages(cases);
                    this.numOfCases = cases.length;
                    if (!this.showSearchResultsSection) {
                        this.showSearchResultsSection = this.numOfCases > 0;
                    }
                    this.isLoading = false;

                    return this.worklistService.getPageData(cases, this.recordsPerPage, pagination.page);
                } else {
                    return [];
                }
            }),
            takeUntil(this.unsubscribe$)
        );
        this._userProfileService.userProfile$.pipe(take(2)).subscribe((userProfile) => {
            this.fullName = `${userProfile?.firstName} ${userProfile?.lastName}`;
        });
    }

    public cleanUpMethodologySelections() {
        if (this.methodologyService.filteredMethodologySectorList) {
            this.methodologyService.filteredMethodologySectorList.forEach((value) => {
                value.forEach((methodology) => (methodology.creditRatingUsed = null));
            });
        }

        if (this.methodologyService.primaryMethodologySectorList) {
            this.methodologyService.primaryMethodologySectorList.forEach((value) => {
                value.forEach((methodology) => (methodology.creditRatingUsed = null));
            });
        }
    }

    calculateTotalPages(cases: Case[]) {
        if (cases.length == 0) {
            this.totalPages = 1;
        } else {
            this.totalPages = Math.ceil(cases.length / this.recordsPerPage);
        }
    }

    sortWorklist(sortBy: SortingOptions, cases: Case[]) {
        this.sortProperty = sortBy;
        cases.sort(this.customSortFn);
    }

    sortChanged(sortBy: SortingOptions) {
        this.isLoading = true;

        this.sortProperty = sortBy;

        this.casesSort$.next(sortBy);

        this.paginator.triggerPageAction(BluePaginatorAction.First);
    }

    dateFilterChanged(filter: WorkListSearchFilter) {
        this.isLoading = true;
        this.sortProperty = null;
        this.worklistService.getAllCasesByDates(filter);
    }

    clearFilterClicked() {
        this.isLoading = true;
        this.sortProperty = null;
        this.resetFieldsSubject.next(true);
        this.worklistService.getAllCases();
    }

    customSortFn = (case1: Case, case2: Case) => {
        let sortResult: number;
        switch (this.sortProperty) {
            case SortingOptions.sortByCreatedDate:
                sortResult = this.sortByCreatedDate(case1, case2);
                break;
            case SortingOptions.sortByLastModifiedDate:
                sortResult = this.sortByModifiedDate(case1, case2);
                break;
            case SortingOptions.sortByMyCase:
                sortResult = this.sortByMyCase(case1, case2);
                break;
            case SortingOptions.sortByName:
            default:
                sortResult = this.sortByName(case1, case2);
                break;
        }
        return sortResult;
    };

    sortByModifiedDate(case1: Case, case2: Case) {
        return case1.lastModifiedDate > case2.lastModifiedDate ? -1 : 1;
    }

    sortByCreatedDate(case1: Case, case2: Case) {
        return case1.createdDate > case2.createdDate ? -1 : 1;
    }

    sortByMyCase(case1: Case, case2: Case) {
        if (
            (case1.createdBy == this.fullName && case2.createdBy == this.fullName) ||
            (case1.createdBy != this.fullName && case2.createdBy != this.fullName)
        ) {
            return case1.lastModifiedDate > case2.lastModifiedDate ? -1 : 1;
        }
        if (case1.createdBy != this.fullName) {
            return 1;
        }
        return -1;
    }

    sortByName(case1: Case, case2: Case) {
        return case1.name?.toLowerCase() < case2.name?.toLowerCase() ? -1 : 1;
    }

    onPageChange(event: BluePaginatorState) {
        this.paginatorChanges$.next(event);
    }

    checkNumOfCasesIsNotZero() {
        if (this.numOfCases > 0) return true;
    }

    caseEventHandler(caseEvent: ModalEvent) {
        if (caseEvent.event == MenuData.rename) {
            this.modalRef = this.modalService.open(EditCaseNameModalComponent, {
                caseName: caseEvent.caseName,
                caseId: caseEvent.caseId,
                updateCaseName: this.updateCaseName.bind(this)
            });
        } else if (caseEvent.event === MenuData.delete) {
            this.modalRef = this.modalService.open(DeleteConfirmationModalComponent, {
                acceptFn: () => {
                    this.worklistService.deleteCaseById(caseEvent.caseId).subscribe();
                    this.cases$.pipe(first()).subscribe((cases) => {
                        const index = cases.findIndex((caseObj) => caseObj.id === caseEvent.caseId);
                        cases.splice(index, 1);
                        if (cases.length == 0) {
                            this.showSearchResultsSection = false;
                        }
                        this.worklistService.updateCases(cases);
                    });
                },
                declineFn: () => {
                    this.modalRef.close();
                }
            });
        }
    }

    /*  TODO Fix nested subscription in this function*/
    updateCaseName(name: string, caseId: string) {
        if (name !== '') {
            this.isLoading = true;
            this.sortProperty = null;
            this.cases$
                .pipe(
                    first(),
                    switchMap((cases) => {
                        const index = cases.findIndex((a) => a.id === caseId);
                        const tempCase = cases[index].caseDataReference;
                        tempCase.id = caseId;
                        tempCase.name = name;
                        tempCase.lastModifiedDate = new Date(new Date().toISOString());
                        tempCase.caseNameOverWritten = true;

                        const committeeSupport = new CommitteeSupport();
                        committeeSupport.createFromCase(tempCase);

                        cases[index].caseDataReference = tempCase;
                        cases[index].id = caseId;
                        cases[index].name = name;
                        cases[index].lastModifiedDate = tempCase.lastModifiedDate;

                        this.worklistService.updateCases(cases);
                        return this.worklistService.updateCase(committeeSupport).pipe(first());
                    })
                )
                .subscribe(() => {
                    this.isLoading = false;
                });
        }
    }

    get retrieveCaseNames() {
        return this.worklistService.getCasesNameAndId();
    }

    searchByName(caseName: string) {
        if (caseName == null) {
            this.casesSearch = null;
        } else {
            this.casesSearch = caseName;
        }
        this.paginator.triggerPageAction(BluePaginatorAction.First);
    }

    private resetPrimaryMethodology() {
        if (this.featureFlagService.getTreatmentState(SplitTreatments.METHODOLOGY_UX_REDESIGN)) {
            this.primaryMethodologyService.resetPrimaryMethodology();
        }
    }

    ngOnDestroy(): void {
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }
}

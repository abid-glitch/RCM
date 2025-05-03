import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { first, map } from 'rxjs/operators';
import { mapCasesData } from '../mappers/case.mapper';
import { Case } from '../types/case';
import { CasesService } from '../../shared/services/cases';
import { CommitteeSupport } from 'src/app/shared/models/CommitteeSupport';

@Injectable({
    providedIn: 'root'
})
export class WorklistService {
    private casesSubject: BehaviorSubject<Case[]>;
    casesObservable: Observable<Case[]>;
    constructor(private readonly casesService: CasesService) {
        this.casesSubject = new BehaviorSubject<Case[]>(null);
        this.casesObservable = this.casesSubject.asObservable();
    }

    get cases(): Observable<Case[]> {
        return this.casesObservable;
    }

    getAllCases() {
        this.casesService
            .getAllCases()
            .pipe(first(), map(mapCasesData))
            .subscribe((cases) => {
                this.casesSubject.next(cases);
            });
    }

    getAllCasesByDates(lastModifiedDateFrom: string, lastModifiedDateTo: string) {
        this.casesService
            .getAllCasesByDates(lastModifiedDateFrom, lastModifiedDateTo)
            .pipe(first(), map(mapCasesData))
            .subscribe((cases) => {
                this.casesSubject.next(cases);
            });
    }

    getPageData(data: Case[], recordsPerPage: number, pageNo = 1) {
        const startIndex = (pageNo - 1) * recordsPerPage;
        const endIndex = pageNo * recordsPerPage;

        return data?.slice(startIndex, endIndex);
    }

    getDefaultPageState(recordsPerPage: number) {
        return { page: 1, firstRowIndex: 0, lastRowIndex: recordsPerPage };
    }

    getCaseById(caseId: string): Observable<CommitteeSupport> {
        return this.casesService.getCaseById(caseId);
    }

    updateCase(cases: CommitteeSupport): Observable<CommitteeSupport> {
        return this.casesService.updateCase(cases);
    }

    updateCases(cases: Case[]) {
        this.casesSubject.next(cases);
    }

    getCasesNameAndId(): string[] {
        const caseSearched = [];

        this.casesObservable
            .pipe(
                first(),
                map((cases) => {
                    if (cases != null) {
                        cases.forEach((data) => {
                            caseSearched.push(data.name);
                        });
                    }
                    return caseSearched;
                })
            )
            .subscribe();

        return caseSearched;
    }

    deleteCaseById(caseId: string): Observable<void> {
        return this.casesService.deleteCaseById(caseId);
    }
    setCasesBehaviourSubjectToNull() {
        this.casesSubject.next(null);
    }
}

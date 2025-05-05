import { Inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AppConfig, AppConfigToken } from '../../../config';
import { NotificationsService } from '../../../core/services/notifications.service';
import { ErrorType } from '../../models/Notification';
import { Observable, throwError } from 'rxjs';
import { CaseData } from '../../types/case-data';
import { CommitteeSupport } from '../../models/CommitteeSupport';
import { catchError } from 'rxjs/operators';
import { CaseEndPoint } from './enums';
import { Router } from '@angular/router';
import { RatingTemplate } from '../../models/RatingTemplate';
import { Cams } from '@app/participants/models/cams';

@Injectable({
    providedIn: 'root'
})
export class CasesService {
    protected readonly endPoint = CaseEndPoint.Cases;
    constructor(
        private httpClient: HttpClient,
        public notificationService: NotificationsService,
        public router: Router,
        @Inject(AppConfigToken) private appConfig: AppConfig
    ) {}

    getAllCases(): Observable<CaseData[]> {
        return this.httpClient.get<CaseData[]>(`${this.appConfig.apiEndpoint}/${this.endPoint}`);
    }

    getCaseById(caseId: string): Observable<CommitteeSupport> {
        return this.httpClient.get<CommitteeSupport>(`${this.appConfig.apiEndpoint}/${this.endPoint}/${caseId}`);
    }

    getAllCasesByDates(lastModifiedDateFrom: string, lastModifiedDateTo: string): Observable<CaseData[]> {
        let queryParams = '?';
        if (lastModifiedDateFrom) {
            queryParams = queryParams + `startDate=${lastModifiedDateFrom}`;
        }
        if (lastModifiedDateTo) {
            queryParams = queryParams + `&endDate=${lastModifiedDateTo}`;
        }
        return this.httpClient.get<CaseData[]>(`${this.appConfig.apiEndpoint}/${this.endPoint}` + queryParams);
    }

    createCase(committeeSupportWrapper: CommitteeSupport): Observable<CommitteeSupport> {
        return this.httpClient
            .post<CommitteeSupport>(`${this.appConfig.apiEndpoint}/${this.endPoint}`, committeeSupportWrapper)
            .pipe(catchError(this.handleError.bind(this)));
    }

    updateCase(committeeSupportWrapper: CommitteeSupport): Observable<CommitteeSupport> {
        return this.httpClient
            .put<CommitteeSupport>(
                `${this.appConfig.apiEndpoint}/${this.endPoint}/${committeeSupportWrapper.id}`,
                committeeSupportWrapper
            )
            .pipe(catchError(this.handleError.bind(this)));
    }

    deleteCaseById(caseId: string): Observable<void> {
        return this.httpClient.delete<void>(`${this.appConfig.apiEndpoint}/${this.endPoint}/${caseId}`);
    }

    handleError(error: HttpErrorResponse) {
        this.notificationService.addNotification(error, ErrorType.CASES_HTTP_REQ_ERROR);
        return throwError(() => error);
    }

    generateDocument(id: string, doc: RatingTemplate, ratingRecommendationViewType: string): Observable<any> {
        const queryParams = this.prepareQueryParams(doc, ratingRecommendationViewType);

        return this.httpClient.get<ArrayBuffer>(
            `${this.appConfig.fileApiEndpoint}/${this.endPoint}/` + id + queryParams,
            { observe: 'response', responseType: 'arraybuffer' as 'json' }
        );
    }

    prepareQueryParams(doc: RatingTemplate, ratingRecommendationViewType: string) {
        let queryParams = '?';

        queryParams = queryParams + `templateType=${doc.toUpperCase()}`;

        queryParams = queryParams + `&ratingRecommendationViewType=${ratingRecommendationViewType}`;
        return queryParams;
    }

    getActionIds(camsId: string): Observable<Cams> {
        return this.httpClient.get<Cams>(`${this.appConfig.apiEndpoint}/invitees?conflictCheckId=${camsId}`);
    }

    deleteCaseRatingCommittee(caseId: string, numberOfCommittee: number): Observable<void> {
        return this.httpClient.delete<void>(
            `${this.appConfig.apiEndpoint}/${this.endPoint}/${caseId}/rating-committee/${numberOfCommittee}`
        );
    }
}

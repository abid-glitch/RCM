import { Inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { CommitteePackageData } from '../repository/types/committee-package-data';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { AppConfig, AppConfigToken } from '@app/config';
import { CaseEndPoint } from '@shared/services/cases';
import { CommitteeConfirmationData } from '../repository/types/committee-confirmation-data';
import { CommitteeMemoCategory } from '@app/shared/services/cases/enums/committee-memo';
import { HeaderService } from '@app/core/header/header.service';
import { CommitteePackageActionListData } from '../models/committee-package-action-list';
import { PublicationData } from './types/publication-data';

@Injectable({
    providedIn: 'root'
})
export class CommitteePackageApiService {
    protected readonly endPoint = CaseEndPoint.Cases;
    constructor(
        private readonly _httpClient: HttpClient,
        @Inject(AppConfigToken) private appConfig: AppConfig,
        private readonly _headerService: HeaderService
    ) {}

    getCommitteePackage(caseId: string, numberOfCommittee: number | null): Observable<any> {
        let url = `${this.appConfig.apiEndpoint}/${this.endPoint}/${caseId}`;
        if (numberOfCommittee !== null) {
            url += `?enrich=close&number=${numberOfCommittee}`;
        }
        return this._httpClient
            .get<any>(url)
            .pipe(
                tap((caseRes) => this._headerService.updateHeaderForCommitteePackageData(caseRes, numberOfCommittee))
            );
    }

    getCamsActionList(camsId: string, createdBy: string): Observable<any> {
        return this._httpClient.get<any>(
            `${this.appConfig.apiEndpoint}/actions?conflictCheckId=${camsId}&username=${createdBy}`
        );
    }

    closeCommittee(caseId: string, committeeConfirmationData: CommitteeConfirmationData) {
        const headers = new HttpHeaders().set('Content-Type', 'application/x.committee.package.close+json;version=1');
        return this._httpClient.put<CommitteePackageData>(
            `${this.appConfig.apiEndpoint}/${this.endPoint}/${caseId}/rating-committee/post-committee`,
            committeeConfirmationData,
            { headers: headers }
        );
    }

    updateCommitteePackage(
        committeePackageData: CommitteePackageData,
        numberOfCommittee: number,
        isAddRatingCommitteeReason: boolean,
        isVoterConfirmed: boolean,
        actionList: CommitteePackageActionListData[],
        publications: PublicationData[],
        isClose: boolean,
        files?: any[],
        actual?: string
    ) {
        if (actionList.length > 0) {
            delete committeePackageData.ratingCommittee.methodologies;
            delete committeePackageData.ratingCommittee.methodologySector;
        }
        const closeCommitteeData = {
            ratingCommittee: {
                ...committeePackageData.ratingCommittee,
                isAddRatingCommitteeReason,
                isVoterConfirmed,
                actual
            },
            teamSetups: committeePackageData.teamSetups,
            entityRatings: committeePackageData.entityRatings,
            packageDocuments: committeePackageData.packageDocuments,
            actionList,
            publications,
            ratingCommitteeNumber: Number(numberOfCommittee)
        };
        const formData = new FormData();
        files?.forEach((file) => {
            formData.append('files', file.file);
        });
        formData.append(
            'committeePackage',
            new Blob([JSON.stringify(closeCommitteeData)], { type: 'application/json' })
        );
        const url = isClose ? 'close-committee' : 'save';
        return this._httpClient.put<any>(
            `${this.appConfig.apiEndpoint}/${this.endPoint}/${committeePackageData.caseId}/rating-committee/${url}`,
            formData
        );
    }

    downloadRCMDocument(caseId: string, ratingRecommendationViewType: string): Observable<any> {
        return this._httpClient.get(`${this.appConfig.apiEndpoint}/cases/${caseId}/documents`, {
            responseType: 'blob',
            observe: 'response',
            params: new HttpParams({
                fromObject: {
                    documentCategory: CommitteeMemoCategory.RatingCommitteeMemo,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    mediaType: 'application/pdf',
                    ratingRecommendationViewType
                }
            })
        });
    }
}

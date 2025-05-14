import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigToken, AppConfig } from 'src/app/config';
import { Domiciles } from '../../models/Domiciles';
import { EntityWrapper } from '../../models/EntityWrapper';
import { Methodology } from '../../models/Methodology';
import { SearchByType } from '../../models/SearchByType';
import { EntityFamily } from '../../models/EntityFamily';
import { Entity } from '../../models/Entity';
import { RatingRecommendation } from '../../../features/rating-recommendation';
import { UltimateParent } from '../../models/UltimateParent';
import { RatingSyncDirection } from '../../models/RatingSyncDirection';
import { RatingResponseValueTypes } from '../../../features/rating-recommendation/enums/rating-recommendation.enum';
import { RatingsMetadataLookup } from '@app/shared/models/RatingsMetadataLookup';
import { RatingClassMetadata } from '@app/shared/models/RatingClassMetadata';
import { RatingScaleMetadata } from '@app/shared/models/RatingScaleMetadata';

@Injectable({
    providedIn: 'root'
})
export class CommitteeSupportService {
    constructor(private httpClient: HttpClient, @Inject(AppConfigToken) private appConfig: AppConfig) {}

    getEntitiesByAnalystName(analystName: string, analystRole: SearchByType): Observable<EntityWrapper> {
        return this.httpClient.get<EntityWrapper>(
            `${this.appConfig.apiEndpoint}/organizations?analyst_name=${analystName}&analyst_role=${analystRole}`
        );
    }

    getRatingsMetadataLookup(): Observable<RatingsMetadataLookup> {
        return this.httpClient.get<RatingsMetadataLookup>(`${this.appConfig.apiEndpoint}/ratings-metadata-lookup`);
    }

    getRatingClasses(): Observable<RatingClassMetadata[]> {
        return this.httpClient.get<RatingClassMetadata[]>(`${this.appConfig.apiEndpoint}/rating-classes`);
    }

    getRatingClassesOptions(
        ratingScaleCode: string,
        ratingScaleStrategy: string,
        domicile: string
    ): Observable<RatingScaleMetadata[]> {
        let params = new HttpParams();
        params = params.append('ratingScaleStrategy', ratingScaleStrategy);
        params = params.append('domicile', domicile);
        params = params.append('ratingScaleType', ratingScaleCode);

        return this.httpClient.get<RatingScaleMetadata[]>(`${this.appConfig.apiEndpoint}/rating-scales`, { params });
    }
    getEntitiesByOrganizationName(organizationName: string): Observable<EntityWrapper> {
        return this.httpClient.get<EntityWrapper>(
            `${this.appConfig.apiEndpoint}/organizations?organization_name=${organizationName}`
        );
    }
    getOrganizationFamily(organizationId: string) {
        return this.httpClient.get<EntityFamily>(
            `${this.appConfig.apiEndpoint}/organizations/${organizationId}/family`
        );
    }

    getDealsByName(dealName: string): Observable<EntityWrapper> {
        return this.httpClient.get<EntityWrapper>(`${this.appConfig.apiEndpoint}/deals?deal_name=${dealName}`);
    }

    getDealsById(dealId: string): Observable<Entity> {
        return this.httpClient.get<Entity>(`${this.appConfig.apiEndpoint}/deals/${dealId}`);
    }

    getDealsByAnalyst(analystName: string): Observable<EntityWrapper> {
        return this.httpClient.get<EntityWrapper>(`${this.appConfig.apiEndpoint}/deals?analyst_name=${analystName}`);
    }

    getDomiciles(): Observable<Domiciles> {
        return this.httpClient.get<Domiciles>(`${this.appConfig.apiEndpoint}/domiciles`);
    }

    getEntitiesByDomicleCodes(domcileCodes: string): Observable<EntityWrapper> {
        return this.httpClient.get<EntityWrapper>(
            `${this.appConfig.apiEndpoint}/organizations?domicile_codes=${domcileCodes}`
        );
    }

    getAllMethodology(): Observable<Record<string, Methodology[]>> {
        return this.httpClient.get<Record<string, Methodology[]>>(`${this.appConfig.apiEndpoint}/methodologies`);
    }

    getRatingRecommendations(
        orgsIds: string[]
    ): Observable<Record<RatingResponseValueTypes.Item, RatingRecommendation[]>> {
        return this.httpClient.get<Record<RatingResponseValueTypes.Item, RatingRecommendation[]>>(
            `${this.appConfig.apiEndpoint}/organizations/ratings?orgIds=${orgsIds}`
        );
    }

    getRatingsSyncedData(entities: Entity[], ratingSyncDirection: RatingSyncDirection) {
        const headers = new HttpHeaders().set('Content-Type', 'application/x.entities+json;version=1');

        return this.httpClient.post<Record<RatingResponseValueTypes.Entities, RatingRecommendation[]>>(
            `${this.appConfig.apiEndpoint}/entities/ratings/propagate-rating-recommendations?ratingSyncDirection=${ratingSyncDirection}`,
            { entities: entities },
            { headers: headers }
        );
    }

    getUltimateParent(orgsIds: string[]): Observable<UltimateParent[]> {
        return this.httpClient.get<UltimateParent[]>(
            `${this.appConfig.apiEndpoint}/organizations/ultimate-parents?orgIds=${orgsIds}`
        );
    }
}

import { HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { take, tap } from 'rxjs/operators';
import { NotificationsService } from 'src/app/core/services/notifications.service';
import { ErrorType } from '../models/Notification';
import { ContentLoaderService } from './content-loader.service';
import { DataService } from './data.service';
import { MethodologyService } from './methodology.service';
import { RatingTemplate } from '../models/RatingTemplate';
import { Subject } from 'rxjs';
import { CasesService } from './cases';
import { LocalizedDatePipe } from '../pipes/localized-date.pipe';

@Injectable({
    providedIn: 'root'
})
export class GenerationService {
    downloadComplete$ = new Subject<void>();
    isRatingRecommendation = false;

    constructor(
        public dataService: DataService,
        public methodologyService: MethodologyService,
        private contentLoaderService: ContentLoaderService,
        private notificationService: NotificationsService,
        private casesService: CasesService,
        private readonly datePipe: LocalizedDatePipe
    ) {}

    generateDocument(docType: RatingTemplate) {
        const ratingRecommendationViewType = this.setRatingRecommendationView();
        this.notificationService.clearNotifications();
        //CODE_DEBT
        //Refactor using concatMap
        switch (docType) {
            case RatingTemplate.Arf: // Access Request Form
                this.generateArfDocumentOnly(docType, ratingRecommendationViewType);
                break;
            case RatingTemplate.Rcm: // Rating Committee Memo Analytical
                this.dataService.emitLoaderSubject('Generating Rating Committee Memo');
                this.generateRcmDocument(docType, ratingRecommendationViewType);
                break;
            case RatingTemplate.ArfRcm:
                this.dataService.emitLoaderSubject('Generating ARF and RCM');
                this.generateArfDocument(RatingTemplate.Arf, ratingRecommendationViewType);
                this.generateRcmDocument(RatingTemplate.Rcm, ratingRecommendationViewType);
                break;

            default:
                throw new Error('Unsupported Document Type.');
        }
    }

    generateArfRcmDocument(docType: RatingTemplate) {
        switch (docType) {
            case RatingTemplate.Arf:
                this.dataService.emitLoaderSubject('Generating Action Request Form');
                this.generateActionRequestForm();
                break;
            case RatingTemplate.Rcm:
                this.dataService.emitLoaderSubject('Generating Rating Committee Memo');
                this.generateRCMDocument();
                break;
            case RatingTemplate.ArfRcm:
                this.dataService.emitLoaderSubject('Generating ARF and RCM');
                this.generateActionRequestForm();
                this.generateRCMDocument();
                break;
            default:
                throw new Error('Unsupported Document Type.');
        }
    }

    private generateArfDocumentOnly(docType: RatingTemplate, ratingRecommendationViewType: string) {
        this.dataService.emitLoaderSubject('Generating Action Request Form');
        this.generateArfDocument(docType, ratingRecommendationViewType);
    }

    generateRcmDocument(docType: RatingTemplate, ratingRecommendationViewType: string, subscribe = true) {
        const res = this.casesService.generateDocument(
            this.dataService.committeSupportWrapper.id,
            docType,
            ratingRecommendationViewType
        );

        if (!subscribe) {
            return res.pipe(tap((response: HttpResponse<Blob>) => this.processResponseFromFilesApi(response)));
        }

        res.pipe(
            take(1),
            tap(() => this.emitCompleted(RatingTemplate.Rcm))
        ).subscribe({
            next: (response) => {
                this.processResponseFromFilesApi(response);
            },
            error: (error: unknown) => {
                this.processErrorFromFilesApi(error as HttpErrorResponse);
                console.log('Error while Generating RCM Document :' + (error as HttpErrorResponse).message);
            }
        });
    }

    processErrorFromFilesApi(error: HttpErrorResponse) {
        this.notificationService.addNotification(error, ErrorType.API_ERROR);
        this.contentLoaderService.hide();
    }

    generateArfDocument(docType: RatingTemplate, ratingRecommendationViewType: string, subscribe = true) {
        const res = this.casesService.generateDocument(
            this.dataService.committeSupportWrapper.id,
            docType,
            ratingRecommendationViewType
        );

        if (!subscribe) {
            return res.pipe(tap((response: HttpResponse<Blob>) => this.processResponseFromFilesApi(response)));
        }

        res.pipe(
            take(1),
            tap(() => this.emitCompleted(RatingTemplate.Arf))
        ).subscribe({
            next: (response) => {
                this.processResponseFromFilesApi(response);
            },
            error: (error: unknown) => {
                this.processErrorFromFilesApi(error as HttpErrorResponse);
                console.log('Error while Generating ARF Document :' + (error as HttpErrorResponse).message);
            }
        });
    }

    generateRCMCoverPagePdfDocument(ratingRecommendationViewType: string, subscribe = true) {
        const res = this.casesService.downloadRCMDocument(
            this.dataService.committeSupportWrapper.id,
            ratingRecommendationViewType
        );

        if (!subscribe) {
            return res.pipe(tap((response: HttpResponse<Blob>) => this.processRCMCoverPagePdfFileDownload(response)));
        }

        res.pipe(
            take(1),
            tap(() => this.emitCompleted(RatingTemplate.Rcm))
        ).subscribe((response: HttpResponse<Blob>) => {
            this.processRCMCoverPagePdfFileDownload(response);
        });
    }

    processResponseFromFilesApi(response: any) {
        this.openBlobAsWordDocument(response.body, response.headers);
        this.contentLoaderService.hide();
    }

    setRatingRecommendationView(): string {
        let ratingRecommendationViewType = '';
        if (this.dataService.committeSupportWrapper.includeDebts) {
            ratingRecommendationViewType = 'RATING_CLASS_AND_DEBTS';
        } else {
            ratingRecommendationViewType = 'RATING_CLASS';
        }
        return ratingRecommendationViewType;
    }

    generateActionRequestForm() {
        this.notificationService.clearNotifications();
        this.dataService
            .generateARFDocument()
            .pipe(
                take(1),
                tap(() => this.emitCompleted(RatingTemplate.Arf))
            )
            .subscribe({
                next: (response) => {
                    this.openBlobAsWordDocument(response.body, response.headers);
                    this.contentLoaderService.hide();
                },
                error: (error: unknown) => {
                    this.notificationService.addNotification(error, ErrorType.API_ERROR);
                    this.contentLoaderService.hide();
                    console.log('Error while Generating ARF Document :' + (error as HttpErrorResponse).message);
                }
            });
    }

    generateRCMDocument() {
        this.notificationService.clearNotifications();
        this.dataService
            .generateRCMDocument()
            .pipe(
                take(1),
                tap(() => this.emitCompleted(RatingTemplate.Rcm))
            )
            .subscribe({
                next: (response) => {
                    this.openBlobAsWordDocument(response.body, response.headers);
                    this.contentLoaderService.hide();
                },
                error: (error: unknown) => {
                    this.notificationService.addNotification(error, ErrorType.API_ERROR);
                    this.contentLoaderService.hide();
                    console.log('Error while Generating RCM Document :' + (error as HttpErrorResponse).message);
                }
            });
    }

    private openBlobAsWordDocument(docBlob: ArrayBuffer, headers: HttpHeaders) {
        const file = new Blob([docBlob], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        const docUrl = window.URL.createObjectURL(file);
        const hrefElement = document.createElement('a');
        hrefElement.href = docUrl;
        hrefElement.download = this.getFileName(headers);
        hrefElement.click();
    }

    private processRCMCoverPagePdfFileDownload(response: HttpResponse<Blob>) {
        const blob = response.body;
        const fileURL = URL.createObjectURL(blob);
        const fileDownloadDom = document.createElement('a');
        document.body.appendChild(fileDownloadDom);
        fileDownloadDom.setAttribute('style', 'display: none');
        fileDownloadDom.href = fileURL;
        const date = this.datePipe.transform(new Date().toISOString(), 'YYYY-MMM-dd');
        const numOfCommittees = this.dataService.committeSupportWrapper.ratingCommitteeInfo.number;
        let entityName =
            this.dataService.committeSupportWrapper.entities.length > 1
                ? 'Multiple Issuers'
                : this.dataService.committeSupportWrapper.entities[0].name;
        let camsId = this.dataService.committeSupportWrapper?.camsId
            ? this.dataService.committeSupportWrapper?.camsId
            : this.dataService.committeSupportWrapper?.committeeMemoSetup?.conflictCheckId;
        const maxFileNameLength = 255;
        const baseFileName = `${date} - ${camsId} - CP - `;
        const suffix = ` - RC ${numOfCommittees}.pdf`;
        const maxEntityNameLength = maxFileNameLength - baseFileName.length - suffix.length;

        if (entityName.length > maxEntityNameLength) {
            entityName = entityName.substring(0, maxEntityNameLength);
        }

        const fileName = `${baseFileName}${entityName}${suffix}`;

        fileDownloadDom.download = fileName;
        fileDownloadDom.click();
        window.URL.revokeObjectURL(fileURL);
        fileDownloadDom.remove();
    }

    private getFileName(headers: HttpHeaders) {
        const contentDisposition = headers.get('Content-Disposition') || '';
        const matches = /filename=([^;]+)/gi.exec(contentDisposition);
        const fileName = matches[1].trim();
        return fileName.replace(/"/g, '');
    }

    /*Reset Helpers*/
    clearMethodologyFlagsAndSelections() {
        this.methodologyService.clearMethodologyFlagsAndSelections();
    }

    /*Rating recommendation Flag is on*/
    emitCompleted(docType: string) {
        if (
            this.dataService.selectedTemplateType === docType ||
            (this.dataService.selectedTemplateType === RatingTemplate.ArfRcm && docType === RatingTemplate.Rcm)
        ) {
            this.downloadComplete$.next();
        }
    }
}

import { EventEmitter, Inject, Injectable } from '@angular/core';
import { BlueModalRef, BlueModalService } from '@moodys/blue-ng';
import { ProcessExitModalComponent } from '../process-flow-exit-modal/process-exit-modal.component';
import { RatingRecommendationProcessExitDialog } from '../enums/rating-recommendation-dialogs-enums';
import { DataService } from '../../services/data.service';
import { ProcessFlowDataManager } from '../../components/bottom-navbar/helpers/processFlowDataManager';
import { EntityService } from '../../services/entity.service';
import { GenerationService } from '../../services/document-generation.service';
import { RatingRecommendationService } from '../../../features/rating-recommendation/services/rating-recommendation.service';
import { CasesService } from '../../services/cases';
import { AppRoutes } from '../../../routes/routes';
import { FeatureFlagService } from '../../services/feature-flag.service';
import { SplitTreatments } from '../../models/SplitTreatment';
import { first, take } from 'rxjs/operators';
import { AdditionalCommitteeConfirmationModalComponent } from '../additional-committee-confirmation-modal/additional-committee-confirmation-modal.component';
import { AdditionalCommitteeConfirmationDialog } from '../enums/additional-committee-confirmation-dialog-enums';
import { HeaderService } from '@app/core/header/header.service';
@Injectable({
    providedIn: 'root'
})
export class ModalActionService extends ProcessFlowDataManager {
    dialogRef: BlueModalRef;
    overlayRef: HTMLElement;
    updateComponentDataEvent: EventEmitter<void> = new EventEmitter<void>();

    constructor(
        @Inject(BlueModalService) private modalService: BlueModalService,
        public entityService: EntityService,
        public dataService: DataService,
        public generationService: GenerationService,
        public ratingRecommendationService: RatingRecommendationService,
        public casesService: CasesService,
        public featureFlagService: FeatureFlagService,
        public _headerService: HeaderService
    ) {
        super(
            entityService,
            dataService,
            generationService,
            ratingRecommendationService,
            casesService,
            featureFlagService
        );
        this.setIsRatingRecommendationFlag();
    }

    openDialog(isCommitteePackage: boolean, onDismiss?: () => void) {
        this._headerService.finalizedDate$.pipe(first()).subscribe((finalizedDate) => {
            if (
                (!isCommitteePackage &&
                    (!this.isRatingRecommendation || !this.entityService.selectedOrgTobeImpacted.length)) ||
                finalizedDate
            ) {
                this.performSimpleNavigation(AppRoutes.WORK_LIST);
                return;
            }
            if (this.dialogRef) {
                this.dialogRef.close();
            }

            this.dialogRef = this.modalService.open(ProcessExitModalComponent, {
                title: RatingRecommendationProcessExitDialog.ExitTitle,
                subtitle: RatingRecommendationProcessExitDialog.ExitSubTitle,
                acceptLabel: RatingRecommendationProcessExitDialog.ExitConfirmButton,
                declineLabel: RatingRecommendationProcessExitDialog.ExitDeclineButton,
                dismissLabel: RatingRecommendationProcessExitDialog.NoActionButton,
                acceptFn: () => {
                    isCommitteePackage ? this.updateComponentDataEvent.emit() : this.performAppUpdate();
                },
                declineFn: () => {
                    this.clearFormDataAndNavigate(AppRoutes.WORK_LIST);
                },
                dismissFn: () => {
                    this.dialogRef.close();
                    onDismiss?.call(this);
                }
            });
        });
    }

    private setIsRatingRecommendationFlag() {
        this.featureFlagService.featureFlags$.pipe(take(2)).subscribe((isFlagOn) => {
            if (isFlagOn) {
                this.isRatingRecommendation = this.featureFlagService.getTreatmentState(
                    SplitTreatments.ONLINE_RATING_RECOMMENDATION_TABLE
                );
            }
        });
    }

    openAdditionalCommitteeDialog() {
        if (this.dialogRef) {
            this.dialogRef.close();
        }

        this.dialogRef = this.modalService.open(AdditionalCommitteeConfirmationModalComponent, {
            title: AdditionalCommitteeConfirmationDialog.ExitTitle,
            acceptLabel: AdditionalCommitteeConfirmationDialog.ExitConfirmButton,
            dismissLabel: AdditionalCommitteeConfirmationDialog.NoActionButton,
            acceptFn: () => {
                this.updateComponentDataEvent.emit();
            },
            dismissFn: () => {
                this.dialogRef.close();
            }
        });
    }
}

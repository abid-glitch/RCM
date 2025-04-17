import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ReviewDirections } from 'src/app/shared/models/ReviewDirections';

@Component({
    selector: 'app-review-direction',
    templateUrl: './review-direction.component.html',
    styleUrls: ['./review-direction.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReviewDirectionComponent {
    @Input() selectedReviewDirections: ReviewDirections[] = [];
    @Output() selectionChanged = new EventEmitter<ReviewDirections[]>();

    reviewDirections: ReviewDirections[] = Object.values(ReviewDirections);

    /*
     * Manages selected input and output an array of reviewDirections[]
     * @Param reviewDirections: string
     * @Output reviewDirections:[]
     * */
    onReviewDirectionChanged(reviewDirections: ReviewDirections): void {
        const indexItem: number = this.selectedReviewDirections.indexOf(reviewDirections);
        if (indexItem > -1) {
            this.selectedReviewDirections.splice(indexItem, 1);
        } else {
            this.selectedReviewDirections.push(reviewDirections);
        }
        this.selectionChanged.emit(this.selectedReviewDirections);
    }
}

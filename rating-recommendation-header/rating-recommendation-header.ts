import { ChangeDetectionStrategy, Component, EventEmitter, Inject, Input, Output, ViewChildren } from '@angular/core';
import { RatingRecommendationTableView } from '../../enums/rating-recommendation.enum';
import {
    ActionMenuProp,
    allActionMenu,
    BulkActionMenu,
    clearSelectionProps,
    DefaultActionMenuData,
    OutlookActionMenu,
    RatingRecommendationHeaderDetail
} from '../../interfaces';
import { BlueModalRef, BlueModalService, BluePopoverAnchor } from '@moodys/blue-ng';
import { AppRoutes } from '../../../../routes/routes';
import { Router } from '@angular/router';

import { RatingRecommendationClearSelectionModalComponent } from '../../modals/rating-recommendation-clear-selection-modal/rating-recommendation-clear-selection-modal.component';

@Component({
    selector: 'app-rating-recommendation-header',
    templateUrl: './rating-recommendation-header.component.html',
    styleUrls: ['./rating-recommendation-header.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RatingRecommendationHeaderComponent {
    @Input() viewTableBy: RatingRecommendationTableView = RatingRecommendationTableView.Class;
    @Output() changeViewTableBy = new EventEmitter<RatingRecommendationTableView>();

    @Input() enableActionButton = false;
    @Input() selectedEntityDetails!: RatingRecommendationHeaderDetail;

    @Input() menuData: { label: string }[] = [
        { label: 'Delete' },
        { label: 'Copy - Create New Case' },
        { label: 'Rating Documents' },
        { label: 'Disclosures' }
    ];

    actionMenuData: BulkActionMenu[] = DefaultActionMenuData;
    outlookMenuData: BulkActionMenu[] = OutlookActionMenu;
    allMenuData: BulkActionMenu[] = allActionMenu;

    tableViewOptions: Record<'label' | 'value', string>[] = Object.entries(RatingRecommendationTableView).map(
        ([key, value]) => ({
            label: key,
            value: value
        })
    );

    /*Reference Action Menu*/
    @ViewChildren(BluePopoverAnchor) bluePopoverAnchor: BluePopoverAnchor[];

    /* Bulk Action */
    @Output() dispatchBulkAction = new EventEmitter<ActionMenuProp<string | number>>();

    clear_selection_modal: BlueModalRef;

    constructor(private router: Router, @Inject(BlueModalService) private modalService: BlueModalService) {}

    emitSelectedViewBy(viewTableBy: RatingRecommendationTableView) {
        this.changeViewTableBy.emit(viewTableBy);
    }

    navToHomePage(): void {
        this.router.navigateByUrl(AppRoutes.WORK_LIST).then();
    }

    onClickBulkActionMenu(menuItemData) {
        if (!menuItemData.children) {
            const menuItemAction: ActionMenuProp<string | number> = {
                ...(menuItemData.props as ActionMenuProp<string | number>),
                tableView: this.viewTableBy
            };
            this.dispatchBulkAction.emit(menuItemAction);

            /*Close Popover Menu*/
            const closePopover = this.bluePopoverAnchor.find((anchor) => anchor.isOpen);
            closePopover?.closePopover();
        }
    }

    clearSelection() {
        this.openDialog();
    }

    openDialog() {
        this.clear_selection_modal = this.modalService.open(RatingRecommendationClearSelectionModalComponent, {
            title: 'Are you sure you want to clear selection',
            acceptLabel: 'YES, CLEAR SELECTION',
            declineLabel: 'NO, STAY HERE',
            acceptFn: () => {
                const menuItemAction: ActionMenuProp<string | number> = {
                    ...(clearSelectionProps as ActionMenuProp<string | number>),
                    tableView: this.viewTableBy
                };
                this.dispatchBulkAction.emit(menuItemAction);
            }
        });
    }
}

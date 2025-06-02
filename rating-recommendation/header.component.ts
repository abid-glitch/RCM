import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { FeatureFlagService } from 'src/app/shared/services/feature-flag.service';
import { UserProfileService } from 'src/app/shared/services/user-profile-service';
import { ModalActionService } from '../../shared/modals/services/modal-action.service';
import { HeaderService } from './header.service';
import { ProfileComponent } from '../profile/profile.component';
import { BlueModalService } from '@moodys/blue-ng';
import { UserProfile } from '@app/shared/models/UserProfile';
import { AppRoutes } from '@app/routes/routes';
import { Router } from '@angular/router';

export enum Languages {
    en = 'en',
    es = 'es',
    default = ''
}

@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent implements OnInit {
    @Input()
    title: string;

    @Input()
    subtitle: string;

    @Input()
    isCaseSection: boolean;

    @Input()
    userProfile: UserProfile;

    language: Languages = Languages.default;

    private titleSub: Subscription;

    private subtitleSub: Subscription;

    private username: string;
    private firstName: string;

    headerMenu: any = [
        {
            label: 'common.home',
            route: ['/'],
            icon: 'home'
        },
        {
            label: 'common.help',
            route: ['/help']
        }
    ];

    appRoutes = AppRoutes;

    constructor(
        private translate: TranslateService,
        private headerService: HeaderService,
        private userProfileService: UserProfileService,
        private featureFlagService: FeatureFlagService,
        private cdrRef: ChangeDetectorRef,
        private modalActionService: ModalActionService,
        private readonly _modalService: BlueModalService,
        private readonly _router: Router
    ) {}

    ngOnInit(): void {
        this.headerService.title$.subscribe(this.onTitleChange.bind(this));
        this.headerService.subtitle$.subscribe(this.onSubtitleChange.bind(this));
        this.featureFlagService.featureFlags$.pipe(take(2)).subscribe((isFlagOn) => {
            if (isFlagOn) {
                this.cdrRef.detectChanges();
            }
        });
        this.userProfileService.userProfile$.pipe(take(2)).subscribe((userProfile) => {
            this.username = userProfile?.username;
            this.firstName = userProfile?.firstName;
        });
    }

    ngOnDestroy(): void {
        this.titleSub?.unsubscribe();
        this.subtitleSub?.unsubscribe();
    }

    onLanguageSwitch(): void {
        this.translate.use(this.language.toString());
    }

    onTitleChange(value: string): void {
        this.title = value;
    }

    onSubtitleChange(value: string): void {
        this.subtitle = value;
    }

    getUsername() {
        return this.username;
    }
    getFirstName() {
        return this.firstName;
    }

    onClickLogo(isCommitteePackage: boolean) {
        if (this.userProfile?.roleReadWrite) {
            this.modalActionService.openDialog(isCommitteePackage);
        } else {
            this._router.navigate(['/', AppRoutes.WORK_LIST]);
        }
    }

    openProfileFlyout() {
        this._modalService.open(ProfileComponent);
    }
}

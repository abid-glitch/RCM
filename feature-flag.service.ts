import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent, Observable } from 'rxjs';
import { AppSettingsService } from 'src/app/app-settings.service';
import { RatingGroupType } from '../models/RatingGroupType';
import { UserProfileService } from './user-profile-service';
import { UserProfile } from '../models/UserProfile';
import { take } from 'rxjs/operators';
import { SplitTreatments } from '../models/SplitTreatment';
import SplitIO from '@splitsoftware/splitio/types/splitio';
import { SplitFactory } from '@splitsoftware/splitio';

@Injectable({
    providedIn: 'root'
})
export class FeatureFlagService {
    private splitio: SplitIO.ISDK;
    private splitClient: SplitIO.IClient;
    private featureFlags: BehaviorSubject<{ featureFlagEnabled: boolean }>;
    public featureFlags$: Observable<{ featureFlagEnabled: boolean }>;
    private username: string;
    private attributes: SplitIO.Attributes;

    constructor(private appSettingsService: AppSettingsService, private userProfileService: UserProfileService) {
        this.featureFlags = new BehaviorSubject(null);
        this.featureFlags$ = this.featureFlags.asObservable();
        this.userProfileService.userProfile$.pipe(take(2)).subscribe((profile) => {
            if (profile != null) {
                this.username = profile.username;
                this.attributes = this.getAttributes(profile);
                this.initSdk();
            }
        });
    }

    private initSdk(): void {
        this.splitio = SplitFactory({
            ...this.appSettingsService.settings.splitConfiguration.featureSet,
            core: {
                authorizationKey: this.appSettingsService.settings.splitConfiguration.apiKey,
                key: this.username,
                trafficType: 'user'
            }
        });
        this.splitClient = this.splitio.client();
        this.verifyReady();
    }
    private verifyReady(): void {
        const isReadyEvent = fromEvent(this.splitClient, this.splitClient.Event.SDK_READY);
        isReadyEvent.subscribe({
            next: () => {
                this.featureFlags.next({ featureFlagEnabled: true });
            },
            error: () => {
                this.featureFlags.next({ featureFlagEnabled: false });
            }
        });
        const isReadyEventTO = fromEvent(this.splitClient, this.splitClient.Event.SDK_READY_TIMED_OUT);
        isReadyEventTO.subscribe({
            next: () => {
                this.featureFlags.next({ featureFlagEnabled: false });
            },
            error: () => {
                this.featureFlags.next({ featureFlagEnabled: false });
            }
        });
    }
    public isTemplateEnabled(ratingGroup: RatingGroupType): boolean {
        const splitName: string = 'rating_group_' + ratingGroup.toLowerCase();
        return this.splitClient?.getTreatment(splitName) === 'on';
    }

    public getTreatmentState(treatmentName: SplitTreatments): boolean {
        return this.splitClient?.getTreatment(treatmentName) === 'on';
    }

    private getAttributes(userProfile: UserProfile): any {
        const propArray: string[] = Object.getOwnPropertyNames(userProfile);
        return Object.values(propArray).map((v) => ({ [v]: userProfile[v] }));
    }

    public isCommitteeWorkflowEnabledFIG(): boolean {
        return this.getTreatmentState(SplitTreatments.FIG);
    }
    public isCommitteeWorkflowEnabledCFG(): boolean {
        return this.getTreatmentState(SplitTreatments.CFG);
    }
    public isCommitteeWorkflowEnabledSOV(): boolean {
        return this.getTreatmentState(SplitTreatments.SOV);
    }
    public isCommitteeWorkflowEnabledSOVMDB(): boolean {
        return this.getTreatmentState(SplitTreatments.SOV_MDB);
    }
    public isCommitteeWorkflowEnabledSUBSOV(): boolean {
        return this.getTreatmentState(SplitTreatments.SUB_SOV);
    }

    isCommitteeWorkflowEnabled(committeSupportWrapper): boolean {
        return (
            this.isSOVCommitteeWorkflowEnabled(committeSupportWrapper) ||
            this.isSUBSOVCommitteeWorkflowEnabled(committeSupportWrapper) ||
            this.isSOVMDBCommitteeWorkflowEnabled(committeSupportWrapper) ||
            this.isCFGCommitteeWorkflowEnabled(committeSupportWrapper) ||
            this.isFIGCommitteeWorkflowEnabled(committeSupportWrapper)
        );
    }

    isSOVCommitteeWorkflowEnabled(committeSupportWrapper) {
        return (
            committeSupportWrapper?.ratingGroupTemplate === RatingGroupType.SovereignBond &&
            this.getTreatmentState(SplitTreatments.SOV)
        );
    }

    isSUBSOVCommitteeWorkflowEnabled(committeSupportWrapper) {
        return (
            committeSupportWrapper?.ratingGroupTemplate === RatingGroupType.SubSovereign &&
            this.getTreatmentState(SplitTreatments.SUB_SOV)
        );
    }

    isSOVMDBCommitteeWorkflowEnabled(committeSupportWrapper) {
        return (
            committeSupportWrapper?.ratingGroupTemplate === RatingGroupType.SovereignMDB &&
            this.getTreatmentState(SplitTreatments.SOV_MDB)
        );
    }

    isCFGCommitteeWorkflowEnabled(committeSupportWrapper) {
        return (
            committeSupportWrapper?.ratingGroupTemplate === RatingGroupType.CFG &&
            this.getTreatmentState(SplitTreatments.CFG)
        );
    }

    isFIGCommitteeWorkflowEnabled(committeSupportWrapper) {
        return (
            (committeSupportWrapper?.ratingGroupTemplate === RatingGroupType.BankingFinanceSecurities ||
                committeSupportWrapper?.ratingGroupTemplate === RatingGroupType.NonBanking) &&
            this.getTreatmentState(SplitTreatments.FIG)
        );
    }
}

import { HeaderService } from '@app/core/header/header.service';
import { CommitteeSupportService } from '@app/shared/services/repos/committee-support.service';
import { Domicile } from '@app/shared/models/Domicile';
import { Participant } from '@app/participants/models/participant';
import { RatingGroupType } from '@app/shared/models/RatingGroupType';
import { UnsavedChanges } from '@app/shared/models/UnsavedChanges';
import { CommitteeTableComponent } from '@app/vote/presenters/committee-table/committee-table.component';
import _ from 'lodash';

@Component({
    selector: 'app-vote',
    templateUrl: './vote.component.html',
    styleUrls: ['./vote.component.scss']
})
export class VoteComponent implements OnDestroy, UnsavedChanges {
    protected emtnChatty$ = new Subject<EmtnChattyPayloads>();
    
    private readonly _ratingCommitteeVoteData$ = this._activatedRoute.data.pipe(
        map((data) => data['vote'] as RatingCommitteeVote),
        shareReplay({ bufferSize: 1, refCount: false })
    );
    
    isFinalized$ = this._ratingCommitteeVoteData$.pipe(
        map((ratingCommitteeVoteData) => !!ratingCommitteeVoteData.finalizedDate)
    );
    
    ratingCommitteeVote$: Observable<RatingCommitteeVote>;
    preCommitteeStart = false;
    preVote = false;
    ineligibleStart = true;
    isEntityFromAUS = false;
    domicileData: Domicile[];
    isFigBanking: boolean;
    
    private readonly _voteOutcomeConfirmation$ = new Subject<RatingCommitteeVoteData>();
    private readonly _preCommitteeStart$ = new Subject<{
        approve: boolean;
        reason: IneligibleStartReason[];
        ineligible: boolean;
        emailCommittee: boolean;
        comment: string;
        hasHongkongSingaporeInvitee: boolean;
        participants: Participant[];
    }>();
    
    private readonly _preVote$ = new Subject<{ approve: boolean; reasonsForDeny: ConfirmationReason[] }>();
    private readonly _save$ = new Subject<{
        ratingCommitteeVote: RatingCommitteeVoteData;
        isClose: boolean;
        redirectToWorklist: boolean;
    }>();
    
    private readonly destroy$ = new Subject<void>();
    
    private readonly _caseId = this._activatedRoute.snapshot.parent.parent.params['caseid'];
    private _numberOfCommittee: number;
    
    private username: string | undefined;
    
    saveSuccessful: BlueToastData = {
        title: this._translateService.instant('vote.changesSaved'),
        theme: BlueToastTheme.Success
    };
    
    private readonly generateIssuerOutlook$ = this._ratingCommitteeVoteData$.pipe(
        switchMap(({ entityRating: [{ entityId: IndexEntityId }] }) =>
            this._issuerOutlookService.createIssuerOutlookStatus(this._caseId, IndexEntityId)
        )
    );
    
    recommendationsDropdownOptionMappings$ = this._ratingRecommendationService.getRecommendationsDropdownOptionMappings;
    userProfile$: Observable<UserProfile> = this.userProfileService.getUserProfile();
    ratingsMetadataLookup$ = this.committeeSupportService.getRatingClasses();
    
    constructor(
        private readonly _modalService: BlueModalService,
        private readonly _voteService: VoteService,
        private readonly _voteApiService: VoteApiService,
        private readonly _modalActionService: ModalActionService,
        private readonly _headerService: HeaderService,
        private readonly notificationsService: NotificationsService,
        private readonly userProfileService: UserProfileService,
        private readonly committeeSupportService: CommitteeSupportService
    ) {
        this._activatedRoute.params.subscribe((params) => {
            this._numberOfCommittee = Number(params['numberOfCommittee']);
        });
        
        /* CODE_DEBT Clean up onErrorResumeNext to ensure we don't hide failure */
        const preCommittee = this._preCommitteeStart$.pipe(
            tap(() => {
                this._contentLoaderService.show();
            }),
            switchMap(
                ({ approve, reason, ineligible, emailCommittee, comment, hasHongkongSingaporeInvitee, participants }) =>
                    this.preCommitteeConfirmation(
                        approve,
                        reason,
                        ineligible,
                        emailCommittee,
                        comment,
                        hasHongkongSingaporeInvitee,
                        participants
                    )
            ),
            switchMap(() => this._voteApiService.getTransactionForVotes(this._caseId, this._numberOfCommittee)),
            tap((transaction) => this._headerService.updateCanDeleteCommittee(transaction.canDeleteCommittee)),
            tap((transaction) => this._voteAdapterService.fromData(transaction)),
            tap(() => this._contentLoaderService.hide()),
            shareReplay({
                bufferSize: 1,
                refCount: true
            })
        );
        
        const preVote = this._preVote$.pipe(
            switchMap(({ approve, reasonsForDeny }) => this.preVoteConfirmation(approve, reasonsForDeny)),
            switchMap(() => this._voteApiService.getTransactionForVotes(this._caseId, this._numberOfCommittee)),
            tap((transaction) => this._voteAdapterService.fromData(transaction)),
            shareReplay({
                bufferSize: 1,
                refCount: true
            })
        );
        
        this.ratingCommitteeVote$ = merge(preCommittee, preVote, this._ratingCommitteeVoteData$).pipe(
            tap((data) => {
                if (data.packageSubmittedDate !== undefined) {
                    const currentDate = Date.now();
                    const submittedDate = new Date(data.packageSubmittedDate).getTime();
                    const differenceInHours = (currentDate - submittedDate) / (1000 * 60 * 60);
                    if (differenceInHours < 24) {
                        this.ineligibleStart = true;
                    }
                }
            })
        );


      const onSaveClose$ = this._save$.pipe(
      tap((( ratingCommitteeVote )) => {
      }),
      switchMap(() => this._voteOutcomeConfirmation$),
      switchMap((ratingCommitteeVote) => {
        this._loadingService.show();
        return this._voteService
          .saveCommitteeVote(this._caseId, ratingCommitteeVote, this._numberOfCommittee)
          .pipe(onErrorResumeNext());
      }),
      tap(() => {
        this.committeeTableFormRef.prevData = _.cloneDeep(
          this.committeeTableFormRef.allFinalRatingsForm.value
        );
      }),
      switchMap(() => from(this._router.navigate(['case', this._caseId, 'rc-close', this._numberOfCommittee])))
    );

    const onSave$ = this._save$.pipe(
      filter((( isClose )) => !isClose),
      switchMap((( ratingCommitteeVote, redirectToWorklist )) => {
        this._loadingService.show();
        return this._voteService
          .saveCommitteeVote(this._caseId, ratingCommitteeVote, this._numberOfCommittee)
          .pipe(
            onErrorResumeNext(),
            tap(() => {
              this.showSuccessMessage();
              this._loadingService.hide();
              this.committeeTableFormRef.prevData = _.cloneDeep(
                this.committeeTableFormRef.allFinalRatingsForm.value
              );
            })
          );
        if (redirectToWorklist) {
          this._router.navigate([AppRoutes.WORK_LIST]);
        }
      })
    );

    merge(onSaveClose$, onSave$).pipe(takeUntil(this.destroy$)).subscribe();

    this.userProfileService.userProfile$
      .pipe(
        filter((userProfile) => !!userProfile),
        take(1)
      )
      .subscribe((userProfile) => {
        this.username = userProfile.username;
      });

    this._modalActionService.updateComponentDataEvent
      .pipe(
        switchMap(() => this.ratingCommitteeVote$),
        takeUntil(this.destroy$)
      )
      .subscribe((ratingCommitteeVote) => {
        if (!ratingCommitteeVote.preCommittee) {
          this._router.navigate([AppRoutes.WORK_LIST]);
        }
      });

    const preCommittee = this._preCommitteeStarts.pipe(
      bufferSize: 1,
      refCount: true
    );

    const preVote = this._preVotes.pipe(
      switchMap((( approve, reasonsForDeny )) => this.preVoteConfirmation(approve, reasonsForDeny)),
      switchMap(() => this._voteApiService.getTransactionForVote$(this._caseId, this._numberOfCommittee)),
      map((transaction) => this._voteAdapterService.fromData(transaction)),
      shareReplay({
        bufferSize: 1,
        refCount: true
      })
    );

    this.ratingCommitteeVote$ = merge(preCommittee, preVote, this._ratingCommitteeVoteData$).pipe(
      tap((data) => {
        if (data.packageSubmittedDate !== undefined) {
          const currentDate = Date.now();
          const submittedDate = new Date(data.packageSubmittedDate).getTime();
          const differenceInHours = (currentDate - submittedDate) / (1000 * 60 * 60);
          if (differenceInHours < 24) {
            this.ineligibleStart = true;
          }
        }
      })
    );

    const onSaveClose$ = this._save$.pipe(
      filter((( isClose )) => !!isClose),
      tap((( ratingCommitteeVote )) => {
        this._loadingService.hide();
        this.openVoteOutcomeModal(ratingCommitteeVote);
      }),
      switchMap(() => this._voteOutcomeConfirmation$),
      switchMap((ratingCommitteeVote) => {
        this._loadingService.show();
        return this._voteService
          .saveCommitteeVote(this._caseId, ratingCommitteeVote, this._numberOfCommittee)
      })
    );
  }

  @ViewChild('committeeTableFormRef') committeeTableFormRef: CommitteeTableComponent;
  public get hasUnsavedChanges() {
    return this.committeeTableFormRef.hasUnsavedChanges;
  }

  saveChanges() {
    this._save$.next({
      isClose: false,
      redirectToWorklist: false,
      ratingCommitteeVote: this.committeeTableFormRef.transform()
    });
  }
  
  discardChanges: () => void;
  ngOnInit(): void {
    this._activatedRoute.data.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      this.domicileData = data.domicileData;
      this.isFigBanking = data.ratingGroupTemplate === RatingGroupType.BankingFinanceSecurities;
      this.isEntityFromAUS = this.domicileData?.some(
        (domicile) => domicile.code === 'AUS' && domicile.name === 'Australia'
      );
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openPreCommitteeConfirmationModal(teamSetup: Participant[]): void {
    this._headerService
      .openActualRatingCommitteeDateModal(this._caseId, this._numberOfCommittee)
      .afterCloseEvent.subscribe(() => {
        this._modalService.open(PreCommitteeConfirmationModalComponent, {
          confirm: {
            approve: boolean,
            reason: IneligibleStartReason[],
            ineligible: boolean,
            emailCommittee: boolean,
            comment: string,
            hasHongkongSingaporeInvitee: boolean,
            participants: Participant[]
          } => {
            this._preCommitteeStarts.next({
              approve,
              reason,
              ineligible,
              emailCommittee,
              comment,
              hasHongkongSingaporeInvitee,
              participants
            });
          },
          cancel: () => {
            console.log('cancel');
          },
          ineligibleStart: this.ineligibleStart,
          numberOfCommittee: this._numberOfCommittee,
          participants: teamSetup.map((participant) => {
            const options: MultiselectOption = {
              label: `${participant.firstName} ${participant.lastName}`,
              value: participant.id.toString(),
              data: participant
            };
            return options;
          })
        });
    });
  }

  openLogVoteModal(): void {
    this._modalService.open(PreVoteConfirmationModalComponent, {
      confirm: (approve: boolean, reasonsForDeny: ConfirmationReason[]) => {
        this._preVotes.next({ approve, reasonsForDeny });
      }
    });
  }

  preVoteConfirmation(confirmed: boolean, reasonsForDeny: ConfirmationReason[]): Observable<null> {
    const voteConfirmation: CommitteeConfirmation = {
      confirmed: confirmed,
      reasonsForDeny: reasonsForDeny
    };
    
    return this._voteService.preVoteConfirmation(this._caseId, voteConfirmation, this._numberOfCommittee);
  }

  preCommitteeConfirmation(
    confirmed: boolean,
    reason: IneligibleStartReason[],
    ineligible: boolean,
    emailCommittee: boolean,
    comment: string,
    hasHongkongSingaporeInvitee: boolean,
    participants: Participant[]
  ): Observable<null> {
    const preCommittee: CommitteeConfirmation = {
      confirmed: confirmed,
      ineligibleStart: ineligible,
      reasonForIneligibleStart: reason,
      emailRatingCommittee: emailCommittee,
      comment: comment,
      hasHongkongSingaporeInvitee: hasHongkongSingaporeInvitee,
      ratingCommitteeNumber: this._numberOfCommittee,
      participants
    };
    
    return this._voteService.preCommitteeApprove(this._caseId, preCommittee);
  }
}

// Image 1
openVoteOutcomeModal(ratingCommitteeVote: RatingCommitteeVoteData): void {
  this._modalService.open(VoteOutcomeModalComponent, {
    confirm: () => this.voteOutcomeConfirmation(ratingCommitteeVote),
    isEntityFromAUS: this.isEntityFromAUS
  });
}

voteOutcomeConfirmation(ratingCommitteeVote: RatingCommitteeVoteData): void {
  this._voteOutcomeConfirmation$.next(ratingCommitteeVote);
}

saveRatingCommitteeVote(event: {
  ratingCommitteeVote: RatingCommitteeVoteData;
  isCloseCommittee: boolean;
  redirectToWorklist: boolean;
  isFinalRatingsTableValid: boolean;
}): void {
  if (event.isCloseCommittee) {
    if (
      !event.isFinalRatingsTableValid ||
      event.ratingCommitteeVote.voteTally === 'null' ||
      event.ratingCommitteeVote.voteTally === null
    ) {

// Image 2
export class VoteComponent implements OnDestroy, UnsavedChanges {
  postVoteConfirmation(event: {
    confirm: (approve: boolean) => {
    }
  }): void {
  }

  cancel: () => {
    console.log('cancel');
  }

  navToBack(): void {
    this._router.navigate([AppRoutes.CASE, this._caseId, AppRoutes.RC_INVITEES, this._numberOfCommittee]);
  }

  navToNext(): void {
    this._router.navigate([AppRoutes.CASE, this._caseId, AppRoutes.RC_CLOSE, this._numberOfCommittee]);
  }

  private showSuccessMessage() {
    const successMessage = "Changes Saved Successfully";
    this.notificationService.addNotification(
      { message: null, type: NotificationType.SUCCESS },
      null,
      null,
      successMessage
    );
  }

// Image 3
export class VoteComponent implements OnDestroy, UnsavedChanges {
  saveRatingCommitteeVote(event: {
  }) {
  }

  postVoteConfirmation(event: {
    ratingCommitteeVote: RatingCommitteeVoteData;
    isCloseCommittee: boolean;
    redirectToWorklist: boolean;
  }): void {
    this._modalService.open(PostVoteConfirmationModalComponent, {
      confirm: (approve: boolean) => {
        const committeeConfirmationData: CommitteeConfirmationData = {
          confirmed: approve,
          user: this.username,
          ...(approve && {
            reasons: [
              {
                key: ReasonsForDeny.Q_5
              }
            ]
          })
        };

        this._voteService
          .postVoteConfirmation(this._caseId, committeeConfirmationData, this._numberOfCommittee)
          .subscribe({
            next: () => {
              this._save$.next({
                ratingCommitteeVote: event.ratingCommitteeVote,
                isClose: event.isCloseCommittee,
                redirectToWorklist: event.redirectToWorklist
              });
            },
            error: (error: unknown) => {
              console.error(error);
            }
          });
      },
      cancel: () => {
        console.log('cancel');
      }
    });
  }

// Image 4
export class VoteComponent implements OnDestroy, UnsavedChanges {
  openVoteOutcomeModal(ratingCommitteeVote: RatingCommitteeVoteData): void {
  }

  voteOutcomeConfirmation(ratingCommitteeVote: RatingCommitteeVoteData): void {
    this._voteOutcomeConfirmation$.next(ratingCommitteeVote);
  }

  saveRatingCommitteeVote(event: {
    ratingCommitteeVote: RatingCommitteeVoteData;
    isCloseCommittee: boolean;
    redirectToWorklist: boolean;
    isFinalRatingsTableValid: boolean;
  }): void {
    if (event.isCloseCommittee) {
      if (
        !event.isFinalRatingsTableValid ||
        event.ratingCommitteeVote.voteTally === 'null' ||
        event.ratingCommitteeVote.voteTally === null
      ) {
        this.notificationService.addNotification(
          {
            message: this._translateService.instant('vote.notification.enterRequiredInfo'),
            type: NotificationType.ERROR
          },
          null,
          null,
          this._translateService.instant('vote.notification.requiredFieldsAreMissing')
        );
        return;
      }
      this.postVoteConfirmation(event);
    } else {
      this._save$.next({
        ratingCommitteeVote: event.ratingCommitteeVote,
        redirectToWorklist: event.redirectToWorklist
      });
    }
  }
